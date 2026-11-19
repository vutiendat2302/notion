from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ProjectStatus = Literal["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category_id: UUID | None = None
    status: ProjectStatus = "ACTIVE"
    start_date: date | None = None
    target_date: date | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Project title cannot be blank.")
        return cleaned


class ProjectPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    category_id: UUID | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    target_date: date | None = None
    archived: bool | None = None
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Project title cannot be blank.")
        return cleaned
