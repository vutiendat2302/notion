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
    username: str | None = None
    email: str | None
    phone: str | None
    display_name: str
    role: str
    status: str
    last_login_at: datetime | None
    created_at: datetime
    settings: UserSettingsResponse | None = None


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    limit: int
    offset: int


class UserSessionResponse(BaseModel):
    id: UUID
    device_label: str | None
    issued_at: datetime
    last_used_at: datetime | None
    expires_at: datetime
    is_current: bool = False
