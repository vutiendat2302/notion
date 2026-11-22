from datetime import date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import habit_logs, habits
from app.modules.habits.schemas.habit_schemas import (
    HabitCreateRequest,
    HabitLogRequest,
    HabitLogResponse,
    HabitPatchRequest,
    HabitResponse,
)
from app.modules.planning.domain.periods import parse_period
from app.modules.users.repositories.user_repository import UserRepository


class HabitService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_habits(
        self,
        user_id: UUID,
        *,
        period_key: str | None = None,
        include_archived: bool = False,
    ) -> list[HabitResponse]:
        stmt = select(habits).where(habits.c.user_id == user_id).order_by(habits.c.created_at.asc())
        if not include_archived:
            stmt = stmt.where(habits.c.archived_at.is_(None))
        rows = (await self.session.execute(stmt)).fetchall()
        if not rows:
            return []

        log_stmt = select(habit_logs).where(habit_logs.c.user_id == user_id)
        if period_key:
            window = parse_period("MONTH", period_key)
            log_stmt = log_stmt.where(
                habit_logs.c.log_date >= window.start_date,
                habit_logs.c.log_date < window.end_date_exclusive,
            )
        log_rows = (await self.session.execute(log_stmt)).fetchall()
        logs_by_habit: dict[UUID, list[HabitLogResponse]] = {}
        for lr in log_rows:
            logs_by_habit.setdefault(lr.habit_id, []).append(
                HabitLogResponse(
                    id=lr.id,
                    habit_id=lr.habit_id,
                    log_date=lr.log_date,
                    status=str(lr.status),
                    value=lr.value,
                    note=lr.note,
                    logged_at=lr.logged_at,
                )
            )

        return [self._row_to_response(row, logs_by_habit.get(row.id, [])) for row in rows]

    async def create_habit(self, user_id: UUID, payload: HabitCreateRequest) -> HabitResponse:
        now = utc_now()
        starts_on = payload.starts_on
        if starts_on is None:
            settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
            tz_name = settings.timezone if settings else "Asia/Ho_Chi_Minh"
            starts_on = datetime.now(ZoneInfo(tz_name)).date()

        habit_id = new_uuid7()
        await self.session.execute(
            insert(habits).values(
                id=habit_id,
                user_id=user_id,
                category_id=payload.category_id,
                title=payload.title.strip(),
                habit_type=payload.habit_type,
                target_value=payload.target_value,
                unit=payload.unit,
                schedule_type=payload.schedule_type,
                weekdays_mask=payload.weekdays_mask,
                target_per_week=payload.target_per_week,
                starts_on=starts_on,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        row = await self._get_owned_habit(user_id, habit_id)
        return self._row_to_response(row, [])

    async def patch_habit(
        self, user_id: UUID, habit_id: UUID, payload: HabitPatchRequest
    ) -> HabitResponse:
        await self._get_owned_habit(user_id, habit_id)
        values: dict[str, Any] = {"updated_at": utc_now()}
        for field in (
            "title",
            "category_id",
            "target_value",
            "unit",
            "schedule_type",
            "weekdays_mask",
            "target_per_week",
        ):
            if field in payload.model_fields_set:
                val = getattr(payload, field)
                values[field] = val.strip() if isinstance(val, str) else val
        if "archived" in payload.model_fields_set and payload.archived is not None:
            values["archived_at"] = utc_now() if payload.archived else None

        await self.session.execute(
            update(habits)
            .where(habits.c.id == habit_id, habits.c.user_id == user_id)
            .values(**values)
        )
        await self.session.commit()
        row = await self._get_owned_habit(user_id, habit_id)
        return self._row_to_response(row, [])

    async def log_habit(
        self, user_id: UUID, habit_id: UUID, payload: HabitLogRequest
    ) -> HabitLogResponse:
        await self._get_owned_habit(user_id, habit_id)
        now = utc_now()
        existing = (
            await self.session.execute(
                select(habit_logs).where(
                    habit_logs.c.habit_id == habit_id,
                    habit_logs.c.log_date == payload.log_date,
                )
            )
        ).first()
        if existing is not None:
            log_id = existing.id
            await self.session.execute(
                update(habit_logs)
                .where(habit_logs.c.id == log_id)
                .values(
                    status=payload.status,
                    value=payload.value,
                    note=payload.note,
                    logged_at=now,
                )
            )
        else:
            log_id = new_uuid7()
            await self.session.execute(
                insert(habit_logs).values(
                    id=log_id,
                    user_id=user_id,
                    habit_id=habit_id,
                    log_date=payload.log_date,
                    status=payload.status,
                    value=payload.value,
                    note=payload.note,
                    logged_at=now,
                    created_at=now,
                )
            )
        await self.session.commit()
        row = (
            await self.session.execute(select(habit_logs).where(habit_logs.c.id == log_id))
        ).first()
        assert row is not None
        return HabitLogResponse(
            id=row.id,
            habit_id=row.habit_id,
            log_date=date.fromisoformat(str(row.log_date)),
            status=str(row.status),
            value=row.value,
            note=row.note,
            logged_at=row.logged_at,
        )

    async def _get_owned_habit(self, user_id: UUID, habit_id: UUID) -> Any:
        row = (
            await self.session.execute(
                select(habits).where(habits.c.id == habit_id, habits.c.user_id == user_id)
            )
        ).first()
        if row is None:
            raise NotFoundError("Habit not found.", code="HABIT_NOT_FOUND")
        return row

    def _row_to_response(self, row: Any, logs: list[HabitLogResponse]) -> HabitResponse:
        return HabitResponse(
            id=row.id,
            category_id=row.category_id,
            title=str(row.title),
            habit_type=str(row.habit_type),
            target_value=row.target_value,
            unit=row.unit,
            schedule_type=str(row.schedule_type),
            weekdays_mask=row.weekdays_mask,
            target_per_week=row.target_per_week,
            starts_on=row.starts_on,
            archived_at=row.archived_at,
            created_at=row.created_at,
            logs=logs,
        )
