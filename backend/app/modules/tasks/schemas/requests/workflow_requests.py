from datetime import date, time
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RecurrenceRuleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frequency: Literal["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]
    interval_value: int = Field(default=1, ge=1, le=365)
    weekdays_mask: int | None = Field(default=None, ge=1, le=127)
    month_day: int | None = Field(default=None, ge=1, le=31)
    monthly_overflow_policy: Literal["SKIP", "CLAMP_TO_LAST_DAY"] = "SKIP"
    default_start_time: time | None = None
    default_duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    starts_on: date
    ends_on: date | None = None
    max_count: int | None = Field(default=None, ge=1, le=10000)
    timezone: str = "Asia/Ho_Chi_Minh"

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (KeyError, ValueError) as exc:
            raise ValueError("Unknown timezone") from exc
        return value

    @model_validator(mode="after")
    def validate_rule(self) -> RecurrenceRuleRequest:
        if self.ends_on is not None and self.ends_on < self.starts_on:
            raise ValueError("ends_on must not precede starts_on")
        if self.default_duration_minutes is not None and self.default_start_time is None:
            raise ValueError("default_duration_minutes requires default_start_time")
        if self.weekdays_mask is not None and self.frequency != "WEEKLY":
            raise ValueError("weekdays_mask is only valid for WEEKLY rules")
        if self.month_day is not None and self.frequency != "MONTHLY":
            raise ValueError("month_day is only valid for MONTHLY rules")
        return self


class RecurrenceEditRequest(RecurrenceRuleRequest):
    effective_date: date
    expected_rule_version: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_effective_date(self) -> RecurrenceEditRequest:
        if self.starts_on > self.effective_date:
            raise ValueError("starts_on must not be after effective_date")
        return self


class ChecklistCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    sort_order: int = Field(default=0, ge=0)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Checklist title cannot be blank")
        return value


class ChecklistPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    archived: bool | None = None


class ChecklistStateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_checked: bool


class DependencyCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    blocking_task_id: UUID
