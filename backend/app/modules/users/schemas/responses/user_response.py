from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


def _mask_preferences(prefs: dict[str, Any] | None) -> dict[str, Any] | None:
    if prefs is None:
        return None
    cloned = dict(prefs)
    ai_cfg = cloned.get("ai")
    if isinstance(ai_cfg, dict):
        safe_ai: dict[str, Any] = {
            "preferred_agent": str(ai_cfg.get("preferred_agent") or "local"),
            "custom_model": ai_cfg.get("custom_model") or "",
        }
        for prov in ("claude", "codex", "gemini"):
            raw_key = str(ai_cfg.get(f"{prov}_api_key") or "").strip()
            safe_ai[f"has_{prov}_key"] = bool(raw_key)
            safe_ai[f"{prov}_key_hint"] = (
                f"••••{raw_key[-4:]}" if len(raw_key) >= 4 else ("••••" if raw_key else "")
            )
        cloned["ai"] = safe_ai
    return cloned


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    timezone: str
    week_starts_on: int
    locale: str
    theme: str
    color_theme: str
    working_hours_json: dict[str, Any] | None
    preferences_json: dict[str, Any] | None = None

    @field_validator("preferences_json", mode="after")
    @classmethod
    def mask_sensitive_preferences(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _mask_preferences(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str | None = None
    email: str | None
    phone: str | None
    display_name: str
    role: str
    status: str
    avatar_file_id: UUID | None = None
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
