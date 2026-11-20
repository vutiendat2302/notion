from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, DBSession
from app.modules.calendar.schemas.calendar_schemas import (
    CalendarConflictsResponse,
    CalendarEventsResponse,
)
from app.modules.calendar.services.calendar_service import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=CalendarEventsResponse)
async def get_calendar_events(
    current_user: CurrentUser,
    session: DBSession,
    start: date = Query(...),
    end: date = Query(...),
) -> CalendarEventsResponse:
    return await CalendarService(session).events(current_user.id, start, end)


@router.get("/conflicts", response_model=CalendarConflictsResponse)
async def get_calendar_conflicts(
    current_user: CurrentUser,
    session: DBSession,
    start_at: datetime = Query(...),
    end_at: datetime = Query(...),
    exclude_occurrence_id: UUID | None = None,
) -> CalendarConflictsResponse:
    return await CalendarService(session).conflicts(
        current_user.id, start_at, end_at, exclude_occurrence_id
    )
