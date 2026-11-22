from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies import CurrentUser, DBSession, get_current_session_id
from app.modules.users.schemas.requests.settings_patch import UserSettingsPatchRequest
from app.modules.users.schemas.requests.user_requests import UserMePatchRequest
from app.modules.users.schemas.responses.user_response import (
    UserResponse,
    UserSessionResponse,
    UserSettingsResponse,
)
from app.modules.users.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def patch_me(
    payload: UserMePatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> UserResponse:
    user = await UserService(session).patch_me(current_user.id, payload)
    return UserResponse.model_validate(user)


@router.patch("/me/settings", response_model=UserSettingsResponse)
async def patch_my_settings(
    payload: UserSettingsPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> UserSettingsResponse:
    settings = await UserService(session).patch_settings(current_user.id, payload)
    return UserSettingsResponse.model_validate(settings)


@router.get("/me/sessions", response_model=list[UserSessionResponse])
async def list_my_sessions(
    current_user: CurrentUser,
    session: DBSession,
    current_sid: Annotated[str | None, Depends(get_current_session_id)],
) -> list[UserSessionResponse]:
    rows = await UserService(session).list_my_sessions(current_user.id)
    return [
        UserSessionResponse(
            id=row.id,
            device_label=row.device_label,
            issued_at=row.issued_at,
            last_used_at=row.last_used_at,
            expires_at=row.expires_at,
            is_current=str(row.id) == current_sid,
        )
        for row in rows
    ]


@router.delete("/me/sessions/{session_id}", status_code=204)
async def revoke_my_session(
    session_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    await UserService(session).revoke_my_session(current_user.id, session_id)
