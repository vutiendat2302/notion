from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HabitCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    category_id: UUID | None = None
    habit_type: Literal["BOOLEAN", "QUANTITATIVE"] = "BOOLEAN"
    target_value: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=32)
    schedule_type: Literal["DAILY", "WEEKDAYS", "X_PER_WEEK"] = "DAILY"
    weekdays_mask: int | None = Field(default=None, ge=1, le=127)
    target_per_week: int | None = Field(default=None, ge=1, le=7)
    starts_on: date | None = None


class HabitPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: UUID | None = None
    target_value: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=32)
    schedule_type: Literal["DAILY", "WEEKDAYS", "X_PER_WEEK"] | None = None
    weekdays_mask: int | None = Field(default=None, ge=1, le=127)
    target_per_week: int | None = Field(default=None, ge=1, le=7)
    archived: bool | None = None


class HabitLogRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    log_date: date
    status: Literal["COMPLETED", "SKIPPED"] = "COMPLETED"
    value: Decimal | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)


class HabitLogResponse(BaseModel):
    id: UUID
    habit_id: UUID
    log_date: date
    status: str
    value: Decimal | None
    note: str | None
    logged_at: datetime


class HabitResponse(BaseModel):
    id: UUID
    category_id: UUID | None
    title: str
    habit_type: str
    target_value: Decimal | None
    unit: str | None
    schedule_type: str
    weekdays_mask: int | None
    target_per_week: int | None
    starts_on: date
    archived_at: datetime | None
    created_at: datetime
    logs: list[HabitLogResponse] = []
