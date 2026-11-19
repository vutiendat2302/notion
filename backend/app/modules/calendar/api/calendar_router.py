from datetime import date

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events")
async def get_calendar_events(
    current_user: CurrentUser,
    start: date = Query(...),
    end: date = Query(...),
) -> dict[str, object]:
    return {
        "user_id": str(current_user.id),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "all_day_occurrences": [],
        "timed_occurrences": [],
    }
