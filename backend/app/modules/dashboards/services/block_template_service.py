from typing import Any
from uuid import UUID

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import block_templates
from app.modules.analytics.domain.chart_specs import CHART_SPECS
from app.modules.dashboards.schemas.dashboard_schemas import (
    BlockTemplateCreateRequest,
    BlockTemplatePatchRequest,
    BlockTemplateResponse,
)


def _builtin_template_seeds() -> list[dict[str, Any]]:
    seeds: list[dict[str, Any]] = [
        # TEXT_FORMAT
        {
            "slug": "title-heading",
            "category": "TEXT_FORMAT",
            "name_vi": "Tiêu đề (H1 / H2 / H3)",
            "name_en": "Title / Heading",
            "description_vi": "H1/H2/H3 · Trái/Giữa/Phải · Hiện trên Outline",
            "description_en": "H1/H2/H3 · Left/Center/Right · Outline linked",
            "icon_name": "Heading1",
            "widget_kind": "METRIC_CARD",
            "default_title": "Title",
            "default_width": 12,
            "default_height": 1,
            "default_spec_json": {
                "preset_type": "TITLE",
                "content": "Section Title",
                "level": "h1",
                "align": "left",
                "border": "none",
            },
            "sort_order": 10,
        },
        {
            "slug": "text-paragraph",
            "category": "TEXT_FORMAT",
            "name_vi": "Đoạn văn bản",
            "name_en": "Text / Paragraph",
            "description_vi": "Ghi chú Markdown (#, ##, ###) & căn lề",
            "description_en": "Notes with Markdown (#, ##, ###) & alignment",
            "icon_name": "Type",
            "widget_kind": "METRIC_CARD",
            "default_title": "Paragraph",
            "default_width": 12,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "TEXT",
                "content": "",
                "align": "left",
                "border": "none",
            },
            "sort_order": 20,
        },
        {
            "slug": "callout-box",
            "category": "TEXT_FORMAT",
            "name_vi": "Callout Box",
            "name_en": "Callout Box",
            "description_vi": "Khung ghi chú nổi bật pastel",
            "description_en": "Highlighted pastel callout box",
            "icon_name": "Sparkles",
            "widget_kind": "METRIC_CARD",
            "default_title": "Callout",
            "default_width": 12,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "CALLOUT",
                "emoji": "💡",
                "content": "Ghi chú quan trọng...",
                "surface": "blue",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 30,
        },
        {
            "slug": "quote-block",
            "category": "TEXT_FORMAT",
            "name_vi": "Trích dẫn (Quote)",
            "name_en": "Quote",
            "description_vi": "Trích dẫn có viền nhấn tinh tế",
            "description_en": "Accent border quote block",
            "icon_name": "Quote",
            "widget_kind": "METRIC_CARD",
            "default_title": "Quote",
            "default_width": 12,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "QUOTE",
                "content": "Illuminate Your Plans.",
                "border": "none",
            },
            "sort_order": 40,
        },
        {
            "slug": "checklist-block",
            "category": "TEXT_FORMAT",
            "name_vi": "Danh sách Checklist",
            "name_en": "Checklist",
            "description_vi": "Danh sách việc nhỏ có thể tick nhanh",
            "description_en": "Inline checkable list",
            "icon_name": "ListChecks",
            "widget_kind": "TASK_LIST",
            "default_title": "Checklist",
            "default_width": 6,
            "default_height": 3,
            "default_spec_json": {
                "preset_type": "CHECKLIST",
                "items": [{"id": "1", "text": "Việc cần làm 1", "done": False}],
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 50,
        },
        {
            "slug": "toggle-block",
            "category": "TEXT_FORMAT",
            "name_vi": "Toggle Thu gọn",
            "name_en": "Toggle Block",
            "description_vi": "Đóng mở chi tiết gọn gàng",
            "description_en": "Collapsible details",
            "icon_name": "MessageSquareQuote",
            "widget_kind": "METRIC_CARD",
            "default_title": "Chi tiết thu gọn",
            "default_width": 6,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "TOGGLE",
                "content": "",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
            },
            "sort_order": 60,
        },
        {
            "slug": "code-block",
            "category": "TEXT_FORMAT",
            "name_vi": "Code Block",
            "name_en": "Code Block",
            "description_vi": "Mã / Lệnh / Ghi chú kỹ thuật",
            "description_en": "Monospace code snippet",
            "icon_name": "Code2",
            "widget_kind": "METRIC_CARD",
            "default_title": "Code",
            "default_width": 6,
            "default_height": 3,
            "default_spec_json": {
                "preset_type": "CODE",
                "language": "markdown",
                "content": "",
                "border": "hairline",
            },
            "sort_order": 70,
        },
        {
            "slug": "hero-banner",
            "category": "TEXT_FORMAT",
            "name_vi": "Hero Banner",
            "name_en": "Hero Banner",
            "description_vi": "Banner đầu trang nổi bật",
            "description_en": "Cover banner card",
            "icon_name": "Sparkles",
            "widget_kind": "METRIC_CARD",
            "default_title": "Workspace Banner",
            "default_width": 12,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "HERO_BANNER",
                "content": "LumiPlan Space",
                "align": "center",
                "surface": "lavender",
                "border": "hairline",
                "radius": "2xl",
            },
            "sort_order": 80,
        },
        {
            "slug": "divider-line",
            "category": "TEXT_FORMAT",
            "name_vi": "Đường kẻ phân tách",
            "name_en": "Divider",
            "description_vi": "Phân cách các phần nội dung",
            "description_en": "Horizontal divider line",
            "icon_name": "Minus",
            "widget_kind": "METRIC_CARD",
            "default_title": "Divider",
            "default_width": 12,
            "default_height": 1,
            "default_spec_json": {"preset_type": "DIVIDER"},
            "sort_order": 90,
        },
        # FORM_TABLE
        {
            "slug": "composite-form-card",
            "category": "FORM_TABLE",
            "name_vi": "Card Bố cục Tự do (Đa thành phần)",
            "name_en": "Composite Layout Card",
            "description_vi": (
                "Card nhiều phần (tiêu đề, form, checklist, tiến độ) thiết kế vị trí tự do"
            ),
            "description_en": "Multi-slot card with customizable internal grid layout",
            "icon_name": "LayoutDashboard",
            "widget_kind": "METRIC_CARD",
            "default_title": "Project Brief Card",
            "default_width": 6,
            "default_height": 4,
            "default_spec_json": {
                "preset_type": "COMPOSITE_CARD",
                "internal_cols": 2,
                "internal_gap": "md",
                "surface": "card",
                "border": "solid",
                "border_width": 1,
                "border_color": "#5D83BB",
                "radius": "2xl",
                "padding": "md",
                "card_slots": [
                    {
                        "id": "slot-head",
                        "kind": "HEADING",
                        "label": "Tiêu đề",
                        "value": "Kế hoạch trọng tâm",
                        "col": 0,
                        "row": 0,
                        "col_span": 1,
                        "row_span": 1,
                        "align": "left",
                        "font_size": "lg",
                        "tone": "default",
                    },
                    {
                        "id": "slot-badge",
                        "kind": "BADGE",
                        "label": "Trạng thái",
                        "value": "Đang ưu tiên",
                        "col": 1,
                        "row": 0,
                        "col_span": 1,
                        "row_span": 1,
                        "align": "right",
                        "font_size": "xs",
                        "tone": "blue",
                    },
                    {
                        "id": "slot-field-1",
                        "kind": "FIELD",
                        "label": "Mục tiêu chính",
                        "value": "",
                        "placeholder": "Nhập mục tiêu...",
                        "col": 0,
                        "row": 1,
                        "col_span": 1,
                        "row_span": 1,
                        "align": "left",
                        "font_size": "sm",
                        "tone": "default",
                    },
                    {
                        "id": "slot-progress",
                        "kind": "PROGRESS",
                        "label": "Tiến độ",
                        "value": "40",
                        "col": 1,
                        "row": 1,
                        "col_span": 1,
                        "row_span": 1,
                        "align": "left",
                        "font_size": "sm",
                        "tone": "sage",
                    },
                    {
                        "id": "slot-checks",
                        "kind": "CHECKLIST",
                        "label": "Việc cần làm",
                        "items": [
                            {"id": "c1", "text": "Bước 1", "done": False},
                            {"id": "c2", "text": "Bước 2", "done": False},
                        ],
                        "col": 0,
                        "row": 2,
                        "col_span": 2,
                        "row_span": 1,
                        "align": "left",
                        "font_size": "sm",
                        "tone": "default",
                    },
                ],
            },
            "sort_order": 95,
        },
        {
            "slug": "custom-table-form",
            "category": "FORM_TABLE",
            "name_vi": "Bảng dữ liệu / Form mẫu",
            "name_en": "Custom Table / Form",
            "description_vi": "Tùy biến cột, hàng, viền và nhập liệu trực tiếp",
            "description_en": "Customizable columns, rows & borders",
            "icon_name": "Table2",
            "widget_kind": "TASK_LIST",
            "default_title": "Target Plan",
            "default_width": 12,
            "default_height": 4,
            "default_spec_json": {
                "preset_type": "CUSTOM_TABLE",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
                "columns": [
                    {"id": "col_week", "label": "Week", "type": "number"},
                    {"id": "col_phase", "label": "Phase", "type": "text"},
                    {"id": "col_target", "label": "Target", "type": "text"},
                ],
                "rows": [
                    {
                        "id": "r1",
                        "cells": {
                            "col_week": "1",
                            "col_phase": "Build nền tảng",
                            "col_target": "3.5",
                        },
                    },
                    {
                        "id": "r2",
                        "cells": {"col_week": "8", "col_phase": "Tăng tốc", "col_target": "4.5"},
                    },
                ],
            },
            "sort_order": 100,
        },
        {
            "slug": "weekly-review-form",
            "category": "FORM_TABLE",
            "name_vi": "Form Đánh giá tuần",
            "name_en": "Weekly Review Form",
            "description_vi": "Bảng theo dõi mục tiêu & trạng thái hàng tuần",
            "description_en": "Weekly goals & status tracker table",
            "icon_name": "ListChecks",
            "widget_kind": "TASK_LIST",
            "default_title": "Weekly Review",
            "default_width": 6,
            "default_height": 4,
            "default_spec_json": {
                "preset_type": "CUSTOM_TABLE",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
                "columns": [
                    {"id": "col_item", "label": "Hạng mục", "type": "text"},
                    {"id": "col_result", "label": "Kết quả", "type": "text"},
                ],
                "rows": [
                    {
                        "id": "r1",
                        "cells": {"col_item": "Hoàn thành chính", "col_result": "Đạt 100%"},
                    }
                ],
            },
            "sort_order": 110,
        },
        # PRODUCTIVITY
        {
            "slug": "plan-database",
            "category": "PRODUCTIVITY",
            "name_vi": "DB Kế hoạch (Năm → Ngày)",
            "name_en": "Plan Database",
            "description_vi": "Quản lý kỳ kế hoạch và gắn Project / Task vào kỳ",
            "description_en": "Manage planning periods and link Projects / Tasks",
            "icon_name": "CalendarRange",
            "widget_kind": "TASK_LIST",
            "default_title": "Kế hoạch",
            "default_width": 12,
            "default_height": 5,
            "default_spec_json": {
                "preset_type": "PLAN_DB",
                "period_type": "WEEK",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 115,
        },
        {
            "slug": "project-database",
            "category": "PRODUCTIVITY",
            "name_vi": "DB Project (Dự án)",
            "name_en": "Project Database",
            "description_vi": "Quản lý dự án, tiến độ và mở danh sách Task con",
            "description_en": "Manage projects, progress and nested child tasks",
            "icon_name": "FolderKanban",
            "widget_kind": "TASK_LIST",
            "default_title": "Projects",
            "default_width": 12,
            "default_height": 5,
            "default_spec_json": {
                "preset_type": "PROJECT_DB",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 118,
        },
        {
            "slug": "today-timeline",
            "category": "PRODUCTIVITY",
            "name_vi": "Today Timeline (Notion Table)",
            "name_en": "Today Timeline",
            "description_vi": "Bảng lọc công việc kiểu Notion & Board",
            "description_en": "Notion Filter Table & Board",
            "icon_name": "Table2",
            "widget_kind": "TASK_LIST",
            "default_title": "Today Timeline",
            "default_width": 12,
            "default_height": 5,
            "default_spec_json": {
                "preset_type": "TODAY_TIMELINE",
                "surface": "paper",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
                "show_filters": True,
            },
            "sort_order": 120,
        },
        {
            "slug": "kpi-overview",
            "category": "PRODUCTIVITY",
            "name_vi": "KPI Overview",
            "name_en": "KPI Overview",
            "description_vi": "Streak · Tỷ lệ hoàn thành · Phút tập trung",
            "description_en": "Streak · Completion · Focus",
            "icon_name": "BarChart3",
            "widget_kind": "METRIC_CARD",
            "default_title": "KPI Overview",
            "default_width": 12,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "KPI_STAT",
                "surface": "blue",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 130,
        },
        {
            "slug": "habits-panel",
            "category": "PRODUCTIVITY",
            "name_vi": "Thói quen hằng ngày",
            "name_en": "Habits Panel",
            "description_vi": "Check thói quen trực tiếp trên trang",
            "description_en": "Daily habits quick check",
            "icon_name": "Check",
            "widget_kind": "TASK_LIST",
            "default_title": "Daily Habits",
            "default_width": 6,
            "default_height": 3,
            "default_spec_json": {
                "preset_type": "HABITS_PANEL",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 140,
        },
        {
            "slug": "goals-panel",
            "category": "PRODUCTIVITY",
            "name_vi": "Mục tiêu & Cột mốc",
            "name_en": "Goals & Milestones",
            "description_vi": "Theo dõi tiến độ mục tiêu & milestone",
            "description_en": "Goal progress & milestones",
            "icon_name": "Sparkles",
            "widget_kind": "TASK_LIST",
            "default_title": "Goals",
            "default_width": 6,
            "default_height": 3,
            "default_spec_json": {
                "preset_type": "GOALS_PANEL",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 150,
        },
        {
            "slug": "streak-card",
            "category": "PRODUCTIVITY",
            "name_vi": "Thẻ Streak",
            "name_en": "Streak Card",
            "description_vi": "Chuỗi ngày liên tiếp",
            "description_en": "Current & best streak",
            "icon_name": "Flame",
            "widget_kind": "METRIC_CARD",
            "default_title": "Streak",
            "default_width": 6,
            "default_height": 2,
            "default_spec_json": {
                "preset_type": "STREAK",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 160,
        },
        {
            "slug": "today-tasks",
            "category": "PRODUCTIVITY",
            "name_vi": "Nhiệm vụ hôm nay",
            "name_en": "Today Tasks",
            "description_vi": "Danh sách nhanh nhiệm vụ trong ngày",
            "description_en": "Compact today task list",
            "icon_name": "ListChecks",
            "widget_kind": "TASK_LIST",
            "default_title": "Nhiệm vụ hôm nay",
            "default_width": 6,
            "default_height": 3,
            "default_spec_json": {
                "preset_type": "TODAY_TASKS",
                "surface": "card",
                "border": "hairline",
                "border_width": 1,
                "radius": "2xl",
            },
            "sort_order": 170,
        },
    ]

    chart_order = 200
    for key, spec in CHART_SPECS.items():
        seeds.append(
            {
                "slug": f"chart-{key.replace('_', '-')}",
                "category": "CHART",
                "name_vi": spec.title_vi,
                "name_en": spec.title_en,
                "description_vi": f"Biểu đồ {spec.space}",
                "description_en": f"{spec.space} dynamic chart",
                "icon_name": "BarChart3",
                "widget_kind": spec.widget_kind,
                "default_title": spec.title_vi,
                "default_width": 12 if spec.widget_kind == "HEATMAP" else 6,
                "default_height": 4,
                "default_spec_json": {
                    "chart_key": spec.chart_key,
                    "filters": {},
                    "surface": "card",
                    "border": "hairline",
                    "border_width": 1,
                    "radius": "2xl",
                },
                "sort_order": chart_order,
            }
        )
        chart_order += 10
    return seeds


class BlockTemplateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ensure_seeded(self) -> None:
        existing_slugs = set(
            (await self.session.execute(select(block_templates.c.slug))).scalars().all()
        )
        all_seeds = _builtin_template_seeds()
        if not existing_slugs:
            seeds_to_insert = all_seeds
        else:
            new_builtin_slugs = {"composite-form-card", "plan-database", "project-database"}
            seeds_to_insert = [
                item
                for item in all_seeds
                if item["slug"] in new_builtin_slugs and item["slug"] not in existing_slugs
            ]
        if not seeds_to_insert:
            return
        now = utc_now()
        rows = []
        for item in seeds_to_insert:
            rows.append(
                {
                    "id": new_uuid7(),
                    "slug": item["slug"],
                    "category": item["category"],
                    "name_vi": item["name_vi"],
                    "name_en": item["name_en"],
                    "description_vi": item["description_vi"],
                    "description_en": item["description_en"],
                    "icon_name": item["icon_name"],
                    "widget_kind": item["widget_kind"],
                    "default_title": item["default_title"],
                    "default_width": item["default_width"],
                    "default_height": item["default_height"],
                    "default_spec_json": item["default_spec_json"],
                    "is_active": True,
                    "is_user_customizable": True,
                    "sort_order": item["sort_order"],
                    "created_at": now,
                    "updated_at": now,
                }
            )
        await self.session.execute(insert(block_templates), rows)
        await self.session.commit()

    async def list_templates(self, *, active_only: bool) -> list[BlockTemplateResponse]:
        await self.ensure_seeded()
        stmt = select(block_templates)
        if active_only:
            stmt = stmt.where(block_templates.c.is_active.is_(True))
        stmt = stmt.order_by(block_templates.c.sort_order.asc(), block_templates.c.name_en.asc())
        rows = (await self.session.execute(stmt)).fetchall()
        return [self._to_response(r) for r in rows]

    async def create_template(
        self, payload: BlockTemplateCreateRequest
    ) -> BlockTemplateResponse:
        await self.ensure_seeded()
        dup = (
            await self.session.execute(
                select(block_templates.c.id).where(block_templates.c.slug == payload.slug)
            )
        ).first()
        if dup is not None:
            raise ConflictError("Template slug already exists.", code="TEMPLATE_SLUG_EXISTS")
        now = utc_now()
        tid = new_uuid7()
        await self.session.execute(
            insert(block_templates).values(
                id=tid,
                slug=payload.slug,
                category=payload.category,
                name_vi=payload.name_vi.strip(),
                name_en=payload.name_en.strip(),
                description_vi=payload.description_vi.strip(),
                description_en=payload.description_en.strip(),
                icon_name=payload.icon_name.strip(),
                widget_kind=payload.widget_kind,
                default_title=payload.default_title.strip(),
                default_width=payload.default_width,
                default_height=payload.default_height,
                default_spec_json=payload.default_spec_json,
                is_active=payload.is_active,
                is_user_customizable=payload.is_user_customizable,
                sort_order=payload.sort_order,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        row = (
            await self.session.execute(select(block_templates).where(block_templates.c.id == tid))
        ).one()
        return self._to_response(row)

    async def patch_template(
        self, template_id: UUID, payload: BlockTemplatePatchRequest
    ) -> BlockTemplateResponse:
        await self.ensure_seeded()
        existing = (
            await self.session.execute(
                select(block_templates).where(block_templates.c.id == template_id)
            )
        ).first()
        if existing is None:
            raise NotFoundError("Template not found.", code="TEMPLATE_NOT_FOUND")
        values: dict[str, Any] = {"updated_at": utc_now()}
        for field in payload.model_fields_set:
            val = getattr(payload, field)
            if val is not None:
                values[field] = val.strip() if isinstance(val, str) else val
        await self.session.execute(
            update(block_templates)
            .where(block_templates.c.id == template_id)
            .values(**values)
        )
        await self.session.commit()
        row = (
            await self.session.execute(
                select(block_templates).where(block_templates.c.id == template_id)
            )
        ).one()
        return self._to_response(row)

    async def delete_template(self, template_id: UUID) -> None:
        await self.ensure_seeded()
        existing = (
            await self.session.execute(
                select(block_templates.c.id).where(block_templates.c.id == template_id)
            )
        ).first()
        if existing is None:
            raise NotFoundError("Template not found.", code="TEMPLATE_NOT_FOUND")
        await self.session.execute(
            delete(block_templates).where(block_templates.c.id == template_id)
        )
        await self.session.commit()

    def _to_response(self, row: Any) -> BlockTemplateResponse:
        return BlockTemplateResponse(
            id=row.id,
            slug=str(row.slug),
            category=str(row.category),
            name_vi=str(row.name_vi),
            name_en=str(row.name_en),
            description_vi=str(row.description_vi or ""),
            description_en=str(row.description_en or ""),
            icon_name=str(row.icon_name or "Sparkles"),
            widget_kind=str(row.widget_kind),
            default_title=str(row.default_title),
            default_width=int(row.default_width),
            default_height=int(row.default_height),
            default_spec_json=dict(row.default_spec_json or {}),
            is_active=bool(row.is_active),
            is_user_customizable=bool(row.is_user_customizable),
            sort_order=int(row.sort_order),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
