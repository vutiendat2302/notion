from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.goals.schemas.goal_schemas import (
    GoalCreateRequest,
    GoalLinkCreateRequest,
    GoalLinkResponse,
    GoalMeasurementCreateRequest,
    GoalMilestoneCreateRequest,
    GoalMilestonePatchRequest,
    GoalMilestoneResponse,
    GoalPatchRequest,
    GoalResponse,
)
from app.modules.goals.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    current_user: CurrentUser,
    session: DBSession,
    include_archived: bool = False,
) -> list[GoalResponse]:
    return await GoalService(session).list_goals(current_user.id, include_archived=include_archived)


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalResponse:
    return await GoalService(session).create_goal(current_user.id, payload)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def patch_goal(
    goal_id: UUID,
    payload: GoalPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalResponse:
    return await GoalService(session).patch_goal(current_user.id, goal_id, payload)


@router.post(
    "/{goal_id}/milestones",
    response_model=GoalMilestoneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_milestone(
    goal_id: UUID,
    payload: GoalMilestoneCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalMilestoneResponse:
    return await GoalService(session).add_milestone(current_user.id, goal_id, payload)


@router.patch("/{goal_id}/milestones/{milestone_id}", response_model=GoalMilestoneResponse)
async def patch_milestone(
    goal_id: UUID,
    milestone_id: UUID,
    payload: GoalMilestonePatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalMilestoneResponse:
    return await GoalService(session).patch_milestone(
        current_user.id, goal_id, milestone_id, payload
    )


@router.post(
    "/{goal_id}/measurements", response_model=GoalResponse, status_code=status.HTTP_201_CREATED
)
async def add_measurement(
    goal_id: UUID,
    payload: GoalMeasurementCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalResponse:
    return await GoalService(session).add_measurement(current_user.id, goal_id, payload)


@router.post(
    "/{goal_id}/links", response_model=GoalLinkResponse, status_code=status.HTTP_201_CREATED
)
async def add_link(
    goal_id: UUID,
    payload: GoalLinkCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> GoalLinkResponse:
    return await GoalService(session).add_link(current_user.id, goal_id, payload)
