from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.dependencies import CurrentAdmin, DBSession
from app.modules.users.schemas.requests.user_requests import (
    AdminUserCreateRequest,
    AdminUserPatchRequest,
)
from app.modules.users.schemas.responses.user_response import UserListResponse, UserResponse
from app.modules.users.services.user_service import UserService

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    _: CurrentAdmin,
    session: DBSession,
    search: str | None = Query(default=None, max_length=120),
    role: Literal["ADMIN", "USER"] | None = Query(default=None),
    user_status: Literal["ACTIVE", "DISABLED", "PENDING_DELETION"] | None = Query(
        default=None, alias="status"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserListResponse:
    rows, total = await UserService(session).list_users_admin(
        search=search, role=role, status=user_status, limit=limit, offset=offset
    )
    return UserListResponse(
        items=[UserResponse.model_validate(item) for item in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreateRequest,
    _: CurrentAdmin,
    session: DBSession,
) -> UserResponse:
    user = await UserService(session).create_user_admin(payload)
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _: CurrentAdmin,
    session: DBSession,
) -> UserResponse:
    user = await UserService(session).get_profile(user_id)
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: UUID,
    payload: AdminUserPatchRequest,
    current_admin: CurrentAdmin,
    session: DBSession,
) -> UserResponse:
    user = await UserService(session).patch_user_admin(
        actor_id=current_admin.id, target_user_id=user_id, payload=payload
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=UserResponse)
async def disable_user(
    user_id: UUID,
    current_admin: CurrentAdmin,
    session: DBSession,
) -> UserResponse:
    user = await UserService(session).disable_user_admin(
        actor_id=current_admin.id, target_user_id=user_id
    )
    return UserResponse.model_validate(user)
