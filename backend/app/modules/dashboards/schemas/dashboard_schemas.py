from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

WidgetKind = Literal["METRIC_CARD", "CHART", "HEATMAP", "PROGRESS", "TASK_LIST"]
TemplateCategory = Literal["TEXT_FORMAT", "PRODUCTIVITY", "FORM_TABLE", "CHART"]


class DashboardCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None


class DashboardPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    style_config: dict[str, Any] | None = None


class WidgetCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    widget_kind: WidgetKind
    title: str = Field(min_length=1, max_length=200)
    spec_json: dict[str, Any]
    position_x: int = Field(default=0, ge=0)
    position_y: int = Field(default=0, ge=0)
    width: int = Field(default=6, ge=1, le=12)
    height: int = Field(default=4, ge=1, le=12)


class WidgetPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    spec_json: dict[str, Any] | None = None
    position_x: int | None = Field(default=None, ge=0)
    position_y: int | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=1, le=12)
    height: int | None = Field(default=None, ge=1, le=12)


class DashboardWidgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dashboard_id: UUID
    widget_kind: str
    title: str
    spec_json: dict[str, Any]
    position_x: int
    position_y: int
    width: int
    height: int
    created_at: datetime
    updated_at: datetime


class DashboardResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    layout_mode: str
    is_default: bool
    style_config: dict[str, Any] = {}
    widgets: list[DashboardWidgetResponse] = []
    created_at: datetime
    updated_at: datetime


class BlockTemplateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    category: TemplateCategory
    name_vi: str = Field(min_length=1, max_length=120)
    name_en: str = Field(min_length=1, max_length=120)
    description_vi: str = Field(default="", max_length=255)
    description_en: str = Field(default="", max_length=255)
    icon_name: str = Field(default="Sparkles", min_length=1, max_length=48)
    widget_kind: WidgetKind
    default_title: str = Field(min_length=1, max_length=200)
    default_width: int = Field(default=6, ge=1, le=12)
    default_height: int = Field(default=3, ge=1, le=12)
    default_spec_json: dict[str, Any] = {}
    is_active: bool = True
    is_user_customizable: bool = True
    sort_order: int = 0


class BlockTemplatePatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: TemplateCategory | None = None
    name_vi: str | None = Field(default=None, min_length=1, max_length=120)
    name_en: str | None = Field(default=None, min_length=1, max_length=120)
    description_vi: str | None = Field(default=None, max_length=255)
    description_en: str | None = Field(default=None, max_length=255)
    icon_name: str | None = Field(default=None, min_length=1, max_length=48)
    widget_kind: WidgetKind | None = None
    default_title: str | None = Field(default=None, min_length=1, max_length=200)
    default_width: int | None = Field(default=None, ge=1, le=12)
    default_height: int | None = Field(default=None, ge=1, le=12)
    default_spec_json: dict[str, Any] | None = None
    is_active: bool | None = None
    is_user_customizable: bool | None = None
    sort_order: int | None = None


class BlockTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    category: str
    name_vi: str
    name_en: str
    description_vi: str
    description_en: str
    icon_name: str
    widget_kind: str
    default_title: str
    default_width: int
    default_height: int
    default_spec_json: dict[str, Any]
    is_active: bool
    is_user_customizable: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
