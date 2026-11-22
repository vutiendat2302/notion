from fastapi import APIRouter

from app.core.config import get_settings
from app.modules.analytics.api.analytics_router import router as analytics_router
from app.modules.auth.api.auth_router import router as auth_router
from app.modules.calendar.api.calendar_router import router as calendar_router
from app.modules.goals.api.goal_router import router as goal_router
from app.modules.planning.api.planning_router import router as planning_router
from app.modules.projects.api.project_router import router as project_router
from app.modules.reminders.api.reminder_router import router as reminder_router
from app.modules.tasks.api.occurrence_router import router as occurrence_router
from app.modules.tasks.api.task_router import router as task_router
from app.modules.taxonomy.api.category_router import router as category_router
from app.modules.time_tracking.api.time_tracking_router import router as time_tracking_router
from app.modules.users.api.admin_user_router import router as admin_user_router
from app.modules.users.api.user_router import router as user_router

api_v1_router = APIRouter(prefix="/api/v1")


@api_v1_router.get("/system/info", tags=["system"])
async def system_info() -> dict[str, object]:
    settings = get_settings()
    return {
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "default_timezone": settings.default_timezone,
        "ai_enabled": settings.ai_enabled,
    }


api_v1_router.include_router(auth_router)
api_v1_router.include_router(user_router)
api_v1_router.include_router(admin_user_router)
api_v1_router.include_router(category_router)
api_v1_router.include_router(project_router)
api_v1_router.include_router(task_router)
api_v1_router.include_router(occurrence_router)
api_v1_router.include_router(planning_router)
api_v1_router.include_router(calendar_router)
api_v1_router.include_router(time_tracking_router)
api_v1_router.include_router(goal_router)
api_v1_router.include_router(reminder_router)
api_v1_router.include_router(analytics_router)
