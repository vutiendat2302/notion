from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TimeEntryStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    occurrence_id: UUID | None = None
    quick_task_title: str | None = Field(default=None, min_length=1, max_length=255)
    quick_task_scheduled_date: date | None = None
    planned_duration_seconds: int | None = Field(default=1500, ge=1, le=86400)
    stop_existing: bool = False
    note: str | None = Field(default=None, max_length=500)


class TimeEntryActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_event_at: datetime | None = None


class TimeEntryCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mark_occurrence_done: bool = False
    client_event_at: datetime | None = None


class TimeEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    occurrence_id: UUID | None
    task_id: UUID | None = None
    task_title: str | None = None
    source: Literal["TIMER", "MANUAL"]
    status: Literal["RUNNING", "PAUSED", "COMPLETED", "CANCELLED"]
    started_at: datetime
    last_resumed_at: datetime | None
    paused_at: datetime | None
    paused_seconds: int
    ended_at: datetime | None
    duration_seconds: int
    planned_duration_seconds: int | None
    effective_elapsed_seconds: int
    note: str | None
    server_now: datetime


class ActiveTimerResponse(BaseModel):
    user_id: UUID
    active_entry: TimeEntryResponse | None
    server_now: datetime
    auto_paused_stale: bool = False
