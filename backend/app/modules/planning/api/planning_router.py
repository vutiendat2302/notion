from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.planning.domain.periods import PeriodType
from app.modules.planning.schemas.planning_schemas import (
    PeriodOverviewResponse,
    PlanItemCreateRequest,
    PlanItemPatchRequest,
    PlanItemResponse,
    RolloverConfirmRequest,
    RolloverConfirmResponse,
    RolloverPreviewRequest,
    RolloverPreviewResponse,
    SavedPlanPutRequest,
    SavedPlanResponse,
)
from app.modules.planning.services.planning_service import PlanningService

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get("/periods/{period_type}/{period_key}", response_model=PeriodOverviewResponse)
async def get_planning_period_overview(
    period_type: PeriodType,
    period_key: str,
    current_user: CurrentUser,
    session: DBSession,
) -> PeriodOverviewResponse:
    return await PlanningService(session).overview(current_user.id, period_type, period_key)


@router.put("/periods/{period_type}/{period_key}/plan", response_model=SavedPlanResponse)
async def put_saved_plan(
    period_type: PeriodType,
    period_key: str,
    payload: SavedPlanPutRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> SavedPlanResponse:
    return await PlanningService(session).put_plan(
        current_user.id, period_type, period_key, payload
    )


@router.post(
    "/plans/{plan_id}/items", response_model=PlanItemResponse, status_code=status.HTTP_201_CREATED
)
async def add_plan_item(
    plan_id: UUID,
    payload: PlanItemCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> PlanItemResponse:
    return await PlanningService(session).add_item(current_user.id, plan_id, payload)


@router.patch("/plans/{plan_id}/items/{item_id}", response_model=PlanItemResponse)
async def patch_plan_item(
    plan_id: UUID,
    item_id: UUID,
    payload: PlanItemPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> PlanItemResponse:
    return await PlanningService(session).patch_item(current_user.id, plan_id, item_id, payload)


@router.delete("/plans/{plan_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan_item(
    plan_id: UUID, item_id: UUID, current_user: CurrentUser, session: DBSession
) -> None:
    await PlanningService(session).delete_item(current_user.id, plan_id, item_id)


@router.post(
    "/periods/{period_type}/{period_key}/rollover/preview",
    response_model=RolloverPreviewResponse,
)
async def preview_rollover(
    period_type: PeriodType,
    period_key: str,
    payload: RolloverPreviewRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> RolloverPreviewResponse:
    return await PlanningService(session).rollover_preview(
        current_user.id, period_type, period_key, payload
    )


@router.post("/rollovers/confirm", response_model=RolloverConfirmResponse)
async def confirm_rollover(
    payload: RolloverConfirmRequest,
    current_user: CurrentUser,
    session: DBSession,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
) -> RolloverConfirmResponse:
    return await PlanningService(session).rollover_confirm(
        current_user.id, payload, idempotency_key
    )
