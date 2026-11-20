from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class CalendarOccurrence(BaseModel):
    occurrence_id: UUID
    task_id: UUID
    title: str
    status: str
    scheduled_date: date | None
    start_at: datetime | None
    end_at: datetime | None
    due_at: datetime | None


class DueMarker(BaseModel):
    occurrence_id: UUID
    task_id: UUID
    title: str
    due_at: datetime


class CalendarEventsResponse(BaseModel):
    user_id: UUID
    start: date
    end: date
    timezone: str
    all_day_occurrences: list[CalendarOccurrence]
    timed_occurrences: list[CalendarOccurrence]
    due_markers: list[DueMarker]


class CalendarConflictsResponse(BaseModel):
    start_at: datetime
    end_at: datetime
    has_conflict: bool
    conflicts: list[CalendarOccurrence]
