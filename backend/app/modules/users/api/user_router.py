from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DBSession
from app.modules.users.schemas.requests.settings_patch import UserSettingsPatchRequest
from app.modules.users.schemas.responses.user_response import UserResponse, UserSettingsResponse
from app.modules.users.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me/settings", response_model=UserSettingsResponse)
async def patch_my_settings(
    payload: UserSettingsPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> UserSettingsResponse:
    settings = await UserService(session).patch_settings(current_user.id, payload)
    return UserSettingsResponse.model_validate(settings)
