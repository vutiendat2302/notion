from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    timezone: str
    week_starts_on: int
    locale: str
    theme: str
    color_theme: str
    working_hours_json: dict[str, Any] | None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    status: str
    last_login_at: datetime | None
    created_at: datetime
    settings: UserSettingsResponse | None = None
