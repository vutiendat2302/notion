from fastapi import APIRouter

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_analytics_overview(current_user: CurrentUser) -> dict[str, object]:
    return {
        "user_id": str(current_user.id),
        "metrics": {
            "completion_rate": None,
            "active_minutes": 0,
            "planned_minutes": 0,
        },
        "data_status": "NO_DATA",
    }
