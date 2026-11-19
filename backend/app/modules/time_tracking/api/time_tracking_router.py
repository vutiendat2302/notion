from fastapi import APIRouter

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/time-entries", tags=["time-tracking"])


@router.get("/active")
async def get_active_timer(current_user: CurrentUser) -> dict[str, object]:
    return {
        "user_id": str(current_user.id),
        "active_entry": None,
    }
