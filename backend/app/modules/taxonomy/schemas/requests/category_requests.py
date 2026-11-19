from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AccentToken = Literal["LAVENDER", "SAGE", "PEACH", "ROSE", "BUTTER", "SKY", "SLATE"]


class CategoryCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    accent_token: AccentToken = "SKY"
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def strip_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name cannot be blank.")
        return cleaned


class CategoryPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=80)
    accent_token: AccentToken | None = None
    sort_order: int | None = Field(default=None, ge=0)
    archived: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_non_empty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name cannot be blank.")
        return cleaned
