from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RecurrenceRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    frequency: str
    interval_value: int
    weekdays_mask: int | None
    month_day: int | None
    monthly_overflow_policy: str
    default_start_time: time | None
    default_duration_minutes: int | None
    starts_on: date
    ends_on: date | None
    max_count: int | None
    timezone: str
    is_paused: bool
    rule_version: int
    created_at: datetime
    updated_at: datetime


class RecurrencePreviewResponse(BaseModel):
    task_id: UUID
    dates: list[date]


class RecurrenceGenerationResponse(BaseModel):
    task_id: UUID
    generated_count: int
    through: date


class ChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    title: str
    sort_order: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChecklistStateResponse(BaseModel):
    occurrence_id: UUID
    checklist_item_id: UUID
    is_checked: bool
    checked_at: datetime | None


class TaskDependencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    blocking_task_id: UUID
    blocked_task_id: UUID
    relation_type: str
    created_at: datetime


class TaskProgressResponse(BaseModel):
    task_id: UUID
    metric_type: str = "OCCURRENCE_COMPLETION"
    unit: str = "percent"
    timezone: str
    window_start: date | None
    window_end_exclusive: date | None
    as_of: date
    eligible_count: int
    completed_count: int
    skipped_count: int
    cancelled_count: int
    future_excluded_count: int
    completion_rate: float | None
    policy: str = "Scheduled/due through as_of; cancelled excluded; skipped eligible"
