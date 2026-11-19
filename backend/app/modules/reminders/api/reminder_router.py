from fastapi import APIRouter

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("")
async def list_reminders(current_user: CurrentUser) -> dict[str, object]:
    return {
        "user_id": str(current_user.id),
        "items": [],
    }
