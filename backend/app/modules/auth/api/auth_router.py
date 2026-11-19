from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.api.dependencies import DBSession
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.modules.auth.schemas.requests.auth_requests import (
    BootstrapUserRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
)
from app.modules.auth.schemas.responses.auth_responses import LogoutResponse, TokenResponse
from app.modules.auth.services.auth_service import AuthService
from app.modules.users.schemas.responses.user_response import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    ttl_seconds: int,
) -> None:
    settings = get_settings()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=ttl_seconds,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 86400,
        path="/api/v1/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")


@router.post("/bootstrap", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def bootstrap_owner(
    payload: BootstrapUserRequest,
    response: Response,
    session: DBSession,
) -> TokenResponse:
    user, access_token, refresh_token, ttl = await AuthService(session).bootstrap_owner(payload)
    _set_auth_cookies(response, access_token, refresh_token, ttl)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    session: DBSession,
) -> TokenResponse:
    user, access_token, refresh_token, ttl = await AuthService(session).login(payload)
    _set_auth_cookies(response, access_token, refresh_token, ttl)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_session(
    response: Response,
    session: DBSession,
    payload: RefreshRequest | None = None,
    refresh_token_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    raw_token = (payload.refresh_token if payload else None) or refresh_token_cookie
    if not raw_token:
        raise UnauthorizedError("Refresh token is missing.", code="MISSING_REFRESH_TOKEN")

    user, access_token, new_refresh_token, ttl = await AuthService(session).refresh(raw_token)
    _set_auth_cookies(response, access_token, new_refresh_token, ttl)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=ttl,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    session: DBSession,
    payload: LogoutRequest | None = None,
    refresh_token_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> LogoutResponse:
    raw_token = (payload.refresh_token if payload else None) or refresh_token_cookie
    revoked = await AuthService(session).logout(raw_token)
    _clear_auth_cookies(response)
    return LogoutResponse(revoked=revoked)
