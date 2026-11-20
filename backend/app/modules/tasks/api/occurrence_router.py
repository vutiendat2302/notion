from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, DBSession
from app.modules.tasks.domain.status_policy import OccurrenceStatus
from app.modules.tasks.schemas.requests.task_requests import OccurrencePatchRequest
from app.modules.tasks.schemas.requests.workflow_requests import ChecklistStateRequest
from app.modules.tasks.schemas.responses.task_responses import (
    OccurrenceListResponse,
    OccurrenceWithTaskResponse,
    TaskOccurrenceResponse,
)
from app.modules.tasks.schemas.responses.workflow_responses import ChecklistStateResponse
from app.modules.tasks.services.task_service import TaskService
from app.modules.tasks.services.workflow_service import WorkflowService
from app.shared.pagination import PaginationMeta

router = APIRouter(prefix="/occurrences", tags=["occurrences"])


@router.get("/{occurrence_id}", response_model=TaskOccurrenceResponse)
async def get_occurrence(
    occurrence_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).get_occurrence(current_user.id, occurrence_id)
    return TaskOccurrenceResponse.model_validate(occ)


@router.get("", response_model=OccurrenceListResponse)
async def list_occurrences(
    current_user: CurrentUser,
    session: DBSession,
    scope: Literal["inbox", "today", "upcoming", "completed", "all"] = "all",
    project_id: UUID | None = None,
    category_id: UUID | None = None,
    search: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> OccurrenceListResponse:
    items, total = await TaskService(session).list_occurrences(
        current_user.id,
        scope=scope,
        project_id=project_id,
        category_id=category_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return OccurrenceListResponse(
        items=[OccurrenceWithTaskResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.patch("/{occurrence_id}", response_model=TaskOccurrenceResponse)
async def patch_occurrence(
    occurrence_id: UUID,
    payload: OccurrencePatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).patch_occurrence(current_user.id, occurrence_id, payload)
    return TaskOccurrenceResponse.model_validate(occ)


@router.post("/{occurrence_id}/complete", response_model=TaskOccurrenceResponse)
async def complete_occurrence(
    occurrence_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).complete_occurrence(current_user.id, occurrence_id)
    return TaskOccurrenceResponse.model_validate(occ)


@router.post("/{occurrence_id}/reopen", response_model=TaskOccurrenceResponse)
async def reopen_occurrence(
    occurrence_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).reopen_occurrence(current_user.id, occurrence_id)
    return TaskOccurrenceResponse.model_validate(occ)


@router.post("/{occurrence_id}/start", response_model=TaskOccurrenceResponse)
async def start_occurrence(
    occurrence_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).set_occurrence_status(
        current_user.id, occurrence_id, OccurrenceStatus.IN_PROGRESS
    )
    return TaskOccurrenceResponse.model_validate(occ)


@router.post("/{occurrence_id}/skip", response_model=TaskOccurrenceResponse)
async def skip_occurrence(
    occurrence_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).set_occurrence_status(
        current_user.id, occurrence_id, OccurrenceStatus.SKIPPED
    )
    return TaskOccurrenceResponse.model_validate(occ)


@router.post("/{occurrence_id}/cancel", response_model=TaskOccurrenceResponse)
async def cancel_occurrence(
    occurrence_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskOccurrenceResponse:
    occ = await TaskService(session).set_occurrence_status(
        current_user.id, occurrence_id, OccurrenceStatus.CANCELLED
    )
    return TaskOccurrenceResponse.model_validate(occ)


@router.get("/{occurrence_id}/checklist", response_model=list[ChecklistStateResponse])
async def list_occurrence_checklist(
    occurrence_id: UUID, current_user: CurrentUser, session: DBSession
) -> list[ChecklistStateResponse]:
    return await WorkflowService(session).list_states(current_user.id, occurrence_id)


@router.put("/{occurrence_id}/checklist/{item_id}", response_model=ChecklistStateResponse)
async def set_occurrence_checklist(
    occurrence_id: UUID,
    item_id: UUID,
    payload: ChecklistStateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> ChecklistStateResponse:
    return await WorkflowService(session).set_state(
        current_user.id, occurrence_id, item_id, payload.is_checked
    )
