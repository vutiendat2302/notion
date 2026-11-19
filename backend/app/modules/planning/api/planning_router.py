from typing import Literal

from fastapi import APIRouter

from app.api.dependencies import CurrentUser

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get("/periods/{period_type}/{period_key}")
async def get_planning_period_overview(
    period_type: Literal["YEAR", "QUARTER", "MONTH", "WEEK", "DAY"],
    period_key: str,
    current_user: CurrentUser,
) -> dict[str, object]:
    return {
        "period_type": period_type,
        "period_key": period_key,
        "user_id": str(current_user.id),
        "saved_plan": None,
        "plan_items": [],
        "status": "SKELETON_READY",
    }
