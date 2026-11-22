from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class BootstrapUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(default=None, max_length=50)
    display_name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, max_length=128)
    accepted_policy: bool = True
    device_label: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_registration(self) -> RegisterRequest:
        has_email = bool(self.email and self.email.strip())
        has_phone = bool(self.phone and self.phone.strip())
        if not has_email and not has_phone:
            raise ValueError("Phải cung cấp ít nhất Email hoặc Số điện thoại.")
        if self.confirm_password is not None and self.confirm_password != self.password:
            raise ValueError("Mật khẩu xác nhận không khớp.")
        if not self.accepted_policy:
            raise ValueError("Bạn cần đồng ý với Chính sách của chúng tôi.")
        return self


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: str | None = Field(default=None, min_length=1, max_length=254)
    email: str | None = Field(default=None, min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    device_label: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def require_identifier(self) -> LoginRequest:
        if not (self.identifier and self.identifier.strip()) and not (
            self.email and self.email.strip()
        ):
            raise ValueError("Vui lòng nhập Tên tài khoản, Email hoặc Số điện thoại.")
        return self


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str | None = Field(default=None, min_length=16, max_length=256)


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str | None = Field(default=None, min_length=16, max_length=256)
