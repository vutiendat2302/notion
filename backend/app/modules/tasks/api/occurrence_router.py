from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, DBSession
from app.modules.tasks.schemas.requests.task_requests import OccurrencePatchRequest
from app.modules.tasks.schemas.responses.task_responses import (
    OccurrenceListResponse,
    OccurrenceWithTaskResponse,
    TaskOccurrenceResponse,
)
from app.modules.tasks.services.task_service import TaskService
from app.shared.pagination import PaginationMeta

router = APIRouter(prefix="/occurrences", tags=["occurrences"])


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
