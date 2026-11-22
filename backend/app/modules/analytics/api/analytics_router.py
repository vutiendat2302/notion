from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, DBSession
from app.modules.analytics.domain.chart_specs import CHART_SPECS
from app.modules.analytics.schemas.analytics_schemas import (
    AnalyticsOverviewResponse,
    ChartCatalogItem,
    ChartEnvelopeResponse,
    StreakResponse,
)
from app.modules.analytics.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    current_user: CurrentUser,
    session: DBSession,
) -> AnalyticsOverviewResponse:
    return await AnalyticsService(session).get_overview(current_user.id)


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    current_user: CurrentUser,
    session: DBSession,
) -> StreakResponse:
    return await AnalyticsService(session).get_streak(current_user.id)


@router.get("/charts", response_model=list[ChartCatalogItem])
async def list_chart_catalog(_: CurrentUser) -> list[ChartCatalogItem]:
    return [
        ChartCatalogItem(
            chart_key=spec.chart_key,
            space=spec.space,
            title_vi=spec.title_vi,
            title_en=spec.title_en,
            widget_kind=spec.widget_kind,
        )
        for spec in CHART_SPECS.values()
    ]


@router.get("/charts/{chart_key}", response_model=ChartEnvelopeResponse)
async def get_chart_data(
    chart_key: str,
    current_user: CurrentUser,
    session: DBSession,
    target_date: date | None = Query(default=None, alias="date"),
    period_key: str | None = None,
    project_id: UUID | None = None,
    task_id: UUID | None = None,
    goal_id: UUID | None = None,
    habit_id: UUID | None = None,
    category_id: UUID | None = None,
    group_by: str = Query(default="project"),
) -> ChartEnvelopeResponse:
    return await AnalyticsService(session).get_chart(
        current_user.id,
        chart_key,
        target_date=target_date,
        period_key=period_key,
        project_id=project_id,
        task_id=task_id,
        goal_id=goal_id,
        habit_id=habit_id,
        category_id=category_id,
        group_by=group_by,
    )
