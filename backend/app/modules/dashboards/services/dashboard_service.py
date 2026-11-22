from typing import Any
from uuid import UUID

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationAppError
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import dashboard_widgets, dashboards
from app.modules.dashboards.schemas.dashboard_schemas import (
    DashboardCreateRequest,
    DashboardPatchRequest,
    DashboardResponse,
    DashboardWidgetResponse,
    WidgetCreateRequest,
    WidgetPatchRequest,
)
from app.modules.users.repositories.user_repository import UserRepository


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_dashboards(self, user_id: UUID) -> list[DashboardResponse]:
        rows = (
            await self.session.execute(
                select(dashboards)
                .where(
                    dashboards.c.user_id == user_id,
                    dashboards.c.archived_at.is_(None),
                )
                .order_by(dashboards.c.created_at.asc())
            )
        ).fetchall()
        return [await self._serialize(user_id, r) for r in rows]

    async def create_dashboard(
        self, user_id: UUID, payload: DashboardCreateRequest
    ) -> DashboardResponse:
        now = utc_now()
        dash_id = new_uuid7()
        await self.session.execute(
            insert(dashboards).values(
                id=dash_id,
                user_id=user_id,
                title=payload.title.strip(),
                description=payload.description,
                layout_mode="RESPONSIVE_GRID",
                is_default=False,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        row = await self._find_owned(user_id, dash_id)
        assert row is not None
        return await self._serialize(user_id, row)

    async def get_dashboard(self, user_id: UUID, dashboard_id: UUID) -> DashboardResponse:
        row = await self._find_owned(user_id, dashboard_id)
        if row is None:
            raise NotFoundError("Page not found.", code="DASHBOARD_NOT_FOUND")
        return await self._serialize(user_id, row)

    async def get_or_create_default(self, user_id: UUID) -> DashboardResponse:
        row = await self._find_default(user_id)
        if row is None:
            now = utc_now()
            dash_id = new_uuid7()
            await self.session.execute(
                insert(dashboards).values(
                    id=dash_id,
                    user_id=user_id,
                    title="Dashboard",
                    description=None,
                    layout_mode="RESPONSIVE_GRID",
                    is_default=True,
                    created_at=now,
                    updated_at=now,
                )
            )
            await self.session.commit()
            row = await self._find_default(user_id)
            assert row is not None
        return await self._serialize(user_id, row)

    async def patch_default(
        self, user_id: UUID, payload: DashboardPatchRequest
    ) -> DashboardResponse:
        dash = await self.get_or_create_default(user_id)
        return await self.patch_dashboard(user_id, dash.id, payload)

    async def patch_dashboard(
        self, user_id: UUID, dashboard_id: UUID, payload: DashboardPatchRequest
    ) -> DashboardResponse:
        row = await self._find_owned(user_id, dashboard_id)
        if row is None:
            raise NotFoundError("Page not found.", code="DASHBOARD_NOT_FOUND")

        values: dict[str, Any] = {"updated_at": utc_now()}
        if "title" in payload.model_fields_set and payload.title:
            values["title"] = payload.title.strip()
        if "description" in payload.model_fields_set:
            values["description"] = payload.description
        await self.session.execute(
            update(dashboards)
            .where(dashboards.c.id == dashboard_id, dashboards.c.user_id == user_id)
            .values(**values)
        )
        if "style_config" in payload.model_fields_set and payload.style_config is not None:
            settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
            if settings is not None:
                prefs = dict(settings.preferences_json or {})
                by_id = dict(prefs.get("dashboard_styles_by_id") or {})
                by_id[str(dashboard_id)] = payload.style_config
                prefs["dashboard_styles_by_id"] = by_id
                prefs["dashboard_style"] = payload.style_config
                settings.preferences_json = prefs
        await self.session.commit()
        updated = await self._find_owned(user_id, dashboard_id)
        assert updated is not None
        return await self._serialize(user_id, updated)

    async def delete_dashboard(self, user_id: UUID, dashboard_id: UUID) -> None:
        row = await self._find_owned(user_id, dashboard_id)
        if row is None:
            raise NotFoundError("Page not found.", code="DASHBOARD_NOT_FOUND")
        if bool(row.is_default):
            raise ValidationAppError("Cannot delete default workspace page.")
        await self.session.execute(
            update(dashboards)
            .where(dashboards.c.id == dashboard_id, dashboards.c.user_id == user_id)
            .values(archived_at=utc_now(), updated_at=utc_now())
        )
        await self.session.commit()

    async def add_widget(
        self, user_id: UUID, payload: WidgetCreateRequest
    ) -> DashboardWidgetResponse:
        dash = await self.get_or_create_default(user_id)
        return await self.add_widget_to_dashboard(user_id, dash.id, payload)

    async def add_widget_to_dashboard(
        self, user_id: UUID, dashboard_id: UUID, payload: WidgetCreateRequest
    ) -> DashboardWidgetResponse:
        row = await self._find_owned(user_id, dashboard_id)
        if row is None:
            raise NotFoundError("Page not found.", code="DASHBOARD_NOT_FOUND")
        now = utc_now()
        widget_id = new_uuid7()
        await self.session.execute(
            insert(dashboard_widgets).values(
                id=widget_id,
                user_id=user_id,
                dashboard_id=dashboard_id,
                widget_kind=payload.widget_kind,
                title=payload.title.strip(),
                spec_json=payload.spec_json,
                position_x=payload.position_x,
                position_y=payload.position_y,
                width=payload.width,
                height=payload.height,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        w = (
            await self.session.execute(
                select(dashboard_widgets).where(dashboard_widgets.c.id == widget_id)
            )
        ).first()
        assert w is not None
        return self._widget_to_response(w)

    async def patch_widget(
        self, user_id: UUID, widget_id: UUID, payload: WidgetPatchRequest
    ) -> DashboardWidgetResponse:
        existing = (
            await self.session.execute(
                select(dashboard_widgets).where(
                    dashboard_widgets.c.id == widget_id,
                    dashboard_widgets.c.user_id == user_id,
                )
            )
        ).first()
        if existing is None:
            raise NotFoundError("Widget not found.", code="WIDGET_NOT_FOUND")
        values: dict[str, Any] = {"updated_at": utc_now()}
        for field in ("title", "spec_json", "position_x", "position_y", "width", "height"):
            if field in payload.model_fields_set and getattr(payload, field) is not None:
                val = getattr(payload, field)
                values[field] = val.strip() if isinstance(val, str) else val
        await self.session.execute(
            update(dashboard_widgets)
            .where(dashboard_widgets.c.id == widget_id, dashboard_widgets.c.user_id == user_id)
            .values(**values)
        )
        await self.session.commit()
        updated = (
            await self.session.execute(
                select(dashboard_widgets).where(dashboard_widgets.c.id == widget_id)
            )
        ).first()
        assert updated is not None
        return self._widget_to_response(updated)

    async def delete_widget(self, user_id: UUID, widget_id: UUID) -> None:
        existing = (
            await self.session.execute(
                select(dashboard_widgets.c.id).where(
                    dashboard_widgets.c.id == widget_id,
                    dashboard_widgets.c.user_id == user_id,
                )
            )
        ).first()
        if existing is None:
            raise NotFoundError("Widget not found.", code="WIDGET_NOT_FOUND")
        await self.session.execute(
            delete(dashboard_widgets).where(
                dashboard_widgets.c.id == widget_id,
                dashboard_widgets.c.user_id == user_id,
            )
        )
        await self.session.commit()

    async def _find_default(self, user_id: UUID) -> Any:
        return (
            await self.session.execute(
                select(dashboards)
                .where(
                    dashboards.c.user_id == user_id,
                    dashboards.c.is_default.is_(True),
                    dashboards.c.archived_at.is_(None),
                )
                .limit(1)
            )
        ).first()

    async def _find_owned(self, user_id: UUID, dashboard_id: UUID) -> Any:
        return (
            await self.session.execute(
                select(dashboards)
                .where(
                    dashboards.c.id == dashboard_id,
                    dashboards.c.user_id == user_id,
                    dashboards.c.archived_at.is_(None),
                )
                .limit(1)
            )
        ).first()

    async def _serialize(self, user_id: UUID, row: Any) -> DashboardResponse:
        w_rows = (
            await self.session.execute(
                select(dashboard_widgets)
                .where(
                    dashboard_widgets.c.dashboard_id == row.id,
                    dashboard_widgets.c.user_id == user_id,
                )
                .order_by(
                    dashboard_widgets.c.position_y.asc(),
                    dashboard_widgets.c.position_x.asc(),
                    dashboard_widgets.c.created_at.asc(),
                )
            )
        ).fetchall()
        settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
        prefs = (settings.preferences_json or {}) if settings else {}
        by_id = prefs.get("dashboard_styles_by_id")
        if isinstance(by_id, dict) and isinstance(by_id.get(str(row.id)), dict):
            style_config = by_id[str(row.id)]
        else:
            style_config = prefs.get("dashboard_style", {})
        return DashboardResponse(
            id=row.id,
            title=str(row.title),
            description=row.description,
            layout_mode=str(row.layout_mode),
            is_default=bool(row.is_default),
            style_config=style_config if isinstance(style_config, dict) else {},
            widgets=[self._widget_to_response(w) for w in w_rows],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _widget_to_response(self, row: Any) -> DashboardWidgetResponse:
        return DashboardWidgetResponse(
            id=row.id,
            dashboard_id=row.dashboard_id,
            widget_kind=str(row.widget_kind),
            title=str(row.title),
            spec_json=dict(row.spec_json or {}),
            position_x=int(row.position_x),
            position_y=int(row.position_y),
            width=int(row.width),
            height=int(row.height),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
