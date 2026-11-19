from fastapi import APIRouter

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("")
async def list_goals(current_user: CurrentUser) -> dict[str, object]:
    return {
        "user_id": str(current_user.id),
        "items": [],
    }
