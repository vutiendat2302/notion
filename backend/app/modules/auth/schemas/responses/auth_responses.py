from pydantic import BaseModel

from app.modules.users.schemas.responses.user_response import UserResponse


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    csrf_token: str | None = None
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class LogoutResponse(BaseModel):
    revoked: bool
