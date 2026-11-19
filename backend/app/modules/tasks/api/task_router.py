from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.tasks.schemas.requests.task_requests import TaskCreateRequest, TaskPatchRequest
from app.modules.tasks.schemas.responses.task_responses import TaskListResponse, TaskResponse
from app.modules.tasks.services.task_service import TaskService
from app.shared.pagination import PaginationMeta

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUser,
    session: DBSession,
    project_id: UUID | None = None,
    category_id: UUID | None = None,
    search: str | None = None,
    include_archived: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> TaskListResponse:
    items, total = await TaskService(session).list_tasks(
        current_user.id,
        project_id=project_id,
        category_id=category_id,
        search=search,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )
    return TaskListResponse(
        items=[TaskResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskResponse:
    task = await TaskService(session).create_task(current_user.id, payload)
    return TaskResponse.model_validate(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskResponse:
    task = await TaskService(session).get_task(current_user.id, task_id)
    return TaskResponse.model_validate(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def patch_task(
    task_id: UUID,
    payload: TaskPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskResponse:
    task = await TaskService(session).patch_task(current_user.id, task_id, payload)
    return TaskResponse.model_validate(task)
