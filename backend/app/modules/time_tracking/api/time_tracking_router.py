from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.time_tracking.schemas.time_entry_schemas import (
    ActiveTimerResponse,
    TimeEntryActionRequest,
    TimeEntryCompleteRequest,
    TimeEntryResponse,
    TimeEntryStartRequest,
)
from app.modules.time_tracking.services.time_tracking_service import TimeTrackingService

router = APIRouter(prefix="/time-entries", tags=["time-tracking"])


@router.get("/active", response_model=ActiveTimerResponse)
async def get_active_timer(current_user: CurrentUser, session: DBSession) -> ActiveTimerResponse:
    return await TimeTrackingService(session).get_active(current_user.id)


@router.get("", response_model=list[TimeEntryResponse])
async def list_time_entries(
    current_user: CurrentUser,
    session: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    task_id: UUID | None = None,
    occurrence_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TimeEntryResponse]:
    return await TimeTrackingService(session).list_entries(
        current_user.id,
        date_from=date_from,
        date_to=date_to,
        task_id=task_id,
        occurrence_id=occurrence_id,
        limit=limit,
    )


@router.post("/start", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
async def start_timer(
    payload: TimeEntryStartRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TimeEntryResponse:
    return await TimeTrackingService(session).start_timer(current_user.id, payload)


@router.post("/{entry_id}/pause", response_model=TimeEntryResponse)
async def pause_timer(
    entry_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    payload: TimeEntryActionRequest | None = None,
) -> TimeEntryResponse:
    return await TimeTrackingService(session).pause_timer(
        current_user.id,
        entry_id,
        client_event_at=payload.client_event_at if payload else None,
    )


@router.post("/{entry_id}/resume", response_model=TimeEntryResponse)
async def resume_timer(
    entry_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    payload: TimeEntryActionRequest | None = None,
) -> TimeEntryResponse:
    return await TimeTrackingService(session).resume_timer(
        current_user.id,
        entry_id,
        client_event_at=payload.client_event_at if payload else None,
    )


@router.post("/{entry_id}/complete", response_model=TimeEntryResponse)
async def complete_timer(
    entry_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    payload: TimeEntryCompleteRequest | None = None,
) -> TimeEntryResponse:
    return await TimeTrackingService(session).complete_timer(
        current_user.id,
        entry_id,
        payload or TimeEntryCompleteRequest(),
    )


@router.post("/{entry_id}/cancel", response_model=TimeEntryResponse)
async def cancel_timer(
    entry_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> TimeEntryResponse:
    return await TimeTrackingService(session).cancel_timer(current_user.id, entry_id)
