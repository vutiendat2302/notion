from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.projects.schemas.requests.project_requests import (
    ProjectCreateRequest,
    ProjectPatchRequest,
    ProjectStatus,
)
from app.modules.projects.schemas.responses.project_responses import ProjectResponse
from app.modules.projects.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: CurrentUser,
    session: DBSession,
    status_filter: ProjectStatus | None = None,
    include_archived: bool = False,
) -> list[ProjectResponse]:
    items = await ProjectService(session).list_projects(
        current_user.id,
        status_filter=status_filter,
        include_archived=include_archived,
    )
    return [ProjectResponse.model_validate(item) for item in items]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> ProjectResponse:
    project = await ProjectService(session).create_project(current_user.id, payload)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID, current_user: CurrentUser, session: DBSession
) -> ProjectResponse:
    project = await ProjectService(session).get_project(current_user.id, project_id)
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def patch_project(
    project_id: UUID,
    payload: ProjectPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> ProjectResponse:
    project = await ProjectService(session).patch_project(current_user.id, project_id, payload)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: UUID, current_user: CurrentUser, session: DBSession) -> None:
    await ProjectService(session).patch_project(
        current_user.id, project_id, ProjectPatchRequest(archived=True)
    )
