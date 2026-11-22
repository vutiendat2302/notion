from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.habits.schemas.habit_schemas import (
    HabitCreateRequest,
    HabitLogRequest,
    HabitLogResponse,
    HabitPatchRequest,
    HabitResponse,
)
from app.modules.habits.services.habit_service import HabitService

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitResponse])
async def list_habits(
    current_user: CurrentUser,
    session: DBSession,
    period_key: str | None = None,
    include_archived: bool = False,
) -> list[HabitResponse]:
    return await HabitService(session).list_habits(
        current_user.id,
        period_key=period_key,
        include_archived=include_archived,
    )


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    payload: HabitCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> HabitResponse:
    return await HabitService(session).create_habit(current_user.id, payload)


@router.patch("/{habit_id}", response_model=HabitResponse)
async def patch_habit(
    habit_id: UUID,
    payload: HabitPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> HabitResponse:
    return await HabitService(session).patch_habit(current_user.id, habit_id, payload)


@router.post("/{habit_id}/logs", response_model=HabitLogResponse)
async def log_habit(
    habit_id: UUID,
    payload: HabitLogRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> HabitLogResponse:
    return await HabitService(session).log_habit(current_user.id, habit_id, payload)
