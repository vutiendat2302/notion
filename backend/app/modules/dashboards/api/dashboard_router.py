from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.dashboards.schemas.dashboard_schemas import (
    DashboardCreateRequest,
    DashboardPatchRequest,
    DashboardResponse,
    DashboardWidgetResponse,
    WidgetCreateRequest,
    WidgetPatchRequest,
)
from app.modules.dashboards.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("", response_model=list[DashboardResponse])
async def list_dashboards(
    current_user: CurrentUser,
    session: DBSession,
) -> list[DashboardResponse]:
    return await DashboardService(session).list_dashboards(current_user.id)


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    payload: DashboardCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardResponse:
    return await DashboardService(session).create_dashboard(current_user.id, payload)


@router.get("/default", response_model=DashboardResponse)
async def get_default_dashboard(
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardResponse:
    return await DashboardService(session).get_or_create_default(current_user.id)


@router.patch("/default", response_model=DashboardResponse)
async def patch_default_dashboard(
    payload: DashboardPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardResponse:
    return await DashboardService(session).patch_default(current_user.id, payload)


@router.post(
    "/default/widgets",
    response_model=DashboardWidgetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_dashboard_widget(
    payload: WidgetCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardWidgetResponse:
    return await DashboardService(session).add_widget(current_user.id, payload)


@router.patch("/default/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def patch_dashboard_widget(
    widget_id: UUID,
    payload: WidgetPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardWidgetResponse:
    return await DashboardService(session).patch_widget(current_user.id, widget_id, payload)


@router.delete("/default/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_widget(
    widget_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    await DashboardService(session).delete_widget(current_user.id, widget_id)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardResponse:
    return await DashboardService(session).get_dashboard(current_user.id, dashboard_id)


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def patch_dashboard(
    dashboard_id: UUID,
    payload: DashboardPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardResponse:
    return await DashboardService(session).patch_dashboard(current_user.id, dashboard_id, payload)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    await DashboardService(session).delete_dashboard(current_user.id, dashboard_id)


@router.post(
    "/{dashboard_id}/widgets",
    response_model=DashboardWidgetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_page_widget(
    dashboard_id: UUID,
    payload: WidgetCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardWidgetResponse:
    return await DashboardService(session).add_widget_to_dashboard(
        current_user.id, dashboard_id, payload
    )


@router.patch("/{dashboard_id}/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def patch_page_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    payload: WidgetPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> DashboardWidgetResponse:
    del dashboard_id
    return await DashboardService(session).patch_widget(current_user.id, widget_id, payload)


@router.delete("/{dashboard_id}/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    del dashboard_id
    await DashboardService(session).delete_widget(current_user.id, widget_id)
