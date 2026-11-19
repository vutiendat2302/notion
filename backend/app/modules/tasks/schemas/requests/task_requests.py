from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TaskPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class TaskCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    project_id: UUID | None = None
    category_id: UUID | None = None
    parent_task_id: UUID | None = None
    priority: TaskPriority = "MEDIUM"
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    due_at: datetime | None = None

    # Default initial occurrence fields
    scheduled_date: date | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def validate_non_blank_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Task title cannot be blank or whitespace only.")
        return cleaned

    @model_validator(mode="after")
    def validate_time_window(self) -> TaskCreateRequest:
        if self.start_at is not None and self.end_at is not None and self.end_at <= self.start_at:
            raise ValueError("end_at must be strictly greater than start_at.")
        return self


class TaskPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    project_id: UUID | None = None
    category_id: UUID | None = None
    priority: TaskPriority | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    due_at: datetime | None = None
    archived: bool | None = None
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("title")
    @classmethod
    def validate_non_blank_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Task title cannot be blank or whitespace only.")
        return cleaned


class OccurrencePatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_date: date | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    due_at: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    sort_order: int | None = Field(default=None, ge=0)
    expected_version: int | None = Field(default=None, ge=1)
