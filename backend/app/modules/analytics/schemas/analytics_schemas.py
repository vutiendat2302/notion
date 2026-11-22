from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


class StreakResponse(BaseModel):
    timezone: str
    today_date: date
    current_streak: int
    best_streak: int
    consistency_30d: float
    total_active_days: int
    today_is_active: bool
    active_dates: list[str]


class ChartCatalogItem(BaseModel):
    chart_key: str
    space: str
    title_vi: str
    title_en: str
    widget_kind: str


class ChartEnvelopeResponse(BaseModel):
    chart_key: str
    space: str
    timezone: str
    period: dict[str, str | None]
    filters_applied: dict[str, str | None]
    data_status: Literal["OK", "NO_DATA"]
    summary: dict[str, Any]
    series: list[dict[str, Any]]
    meta: dict[str, Any] = {}


class AnalyticsOverviewResponse(BaseModel):
    user_id: UUID
    streak: StreakResponse
    metrics: dict[str, Any]
    data_status: Literal["OK", "NO_DATA"]
