from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.shared.pagination import PaginationMeta


class TaskOccurrenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    recurrence_rule_id: UUID | None
    recurrence_key: str
    scheduled_date: date | None
    start_at: datetime | None
    end_at: datetime | None
    due_at: datetime | None
    estimated_minutes: int | None
    status: str
    completed_at: datetime | None
    is_override: bool
    sort_order: int
    version: int
    created_at: datetime
    updated_at: datetime


class TaskSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID | None
    category_id: UUID | None
    parent_task_id: UUID | None
    title: str
    description: str | None
    priority: str
    estimated_minutes: int | None
    due_at: datetime | None
    is_recurring: bool
    version: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskResponse(TaskSummaryResponse):
    occurrences: list[TaskOccurrenceResponse] = []


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    pagination: PaginationMeta


class OccurrenceWithTaskResponse(TaskOccurrenceResponse):
    task: TaskSummaryResponse


class OccurrenceListResponse(BaseModel):
    items: list[OccurrenceWithTaskResponse]
    pagination: PaginationMeta
