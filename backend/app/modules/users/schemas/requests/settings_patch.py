from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserSettingsPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    week_starts_on: int | None = Field(default=None, ge=1, le=7)
    locale: str | None = Field(default=None, min_length=2, max_length=16)
    theme: Literal["LIGHT", "DARK", "SYSTEM"] | None = None
    color_theme: str | None = Field(default=None, min_length=1, max_length=32)
    working_hours_json: dict[str, Any] | None = None
    preferences_json: dict[str, Any] | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"Unknown IANA timezone: {value}") from exc
        return value
