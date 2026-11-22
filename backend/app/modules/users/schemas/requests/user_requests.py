from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UserMePatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(default=None, max_length=50)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)


class AdminUserCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(default=None, max_length=50)
    display_name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["ADMIN", "USER"] = "USER"
    status: Literal["ACTIVE", "DISABLED"] = "ACTIVE"

    @model_validator(mode="after")
    def require_email_or_phone(self) -> AdminUserCreateRequest:
        if not (self.email and self.email.strip()) and not (self.phone and self.phone.strip()):
            raise ValueError("Phải cung cấp ít nhất Email hoặc Số điện thoại.")
        return self


class AdminUserPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(default=None, max_length=50)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    role: Literal["ADMIN", "USER"] | None = None
    status: Literal["ACTIVE", "DISABLED", "PENDING_DELETION"] | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
