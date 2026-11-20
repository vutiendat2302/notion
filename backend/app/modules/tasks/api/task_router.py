from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.dependencies import CurrentUser, DBSession
from app.core.exceptions import ValidationAppError
from app.modules.tasks.schemas.requests.task_requests import TaskCreateRequest, TaskPatchRequest
from app.modules.tasks.schemas.requests.workflow_requests import (
    ChecklistCreateRequest,
    ChecklistPatchRequest,
    DependencyCreateRequest,
    RecurrenceEditRequest,
    RecurrenceRuleRequest,
)
from app.modules.tasks.schemas.responses.task_responses import (
    TaskListResponse,
    TaskOccurrenceResponse,
    TaskResponse,
)
from app.modules.tasks.schemas.responses.workflow_responses import (
    ChecklistItemResponse,
    RecurrenceGenerationResponse,
    RecurrencePreviewResponse,
    RecurrenceRuleResponse,
    TaskDependencyResponse,
    TaskProgressResponse,
)
from app.modules.tasks.services.recurrence_service import RecurrenceService
from app.modules.tasks.services.task_service import TaskService
from app.modules.tasks.services.workflow_service import WorkflowService
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


@router.post("/{task_id}/duplicate", response_model=TaskResponse, status_code=201)
async def duplicate_task(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskResponse:
    task = await TaskService(session).duplicate_task(current_user.id, task_id)
    return TaskResponse.model_validate(task)


@router.get("/{task_id}/progress", response_model=TaskProgressResponse)
async def task_progress(
    task_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    start: date | None = None,
    end: date | None = None,
) -> TaskProgressResponse:
    return await TaskService(session).task_progress(current_user.id, task_id, start, end)


@router.post("/{task_id}/archive", response_model=TaskResponse)
async def archive_task(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskResponse:
    task = await TaskService(session).patch_task(
        current_user.id, task_id, TaskPatchRequest(archived=True)
    )
    return TaskResponse.model_validate(task)


@router.post("/{task_id}/restore", response_model=TaskResponse)
async def restore_task(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> TaskResponse:
    task = await TaskService(session).patch_task(
        current_user.id, task_id, TaskPatchRequest(archived=False)
    )
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: UUID, current_user: CurrentUser, session: DBSession) -> None:
    await TaskService(session).patch_task(current_user.id, task_id, TaskPatchRequest(archived=True))


@router.post("/{task_id}/subtasks", response_model=TaskResponse, status_code=201)
async def create_subtask(
    task_id: UUID,
    payload: TaskCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskResponse:
    if payload.parent_task_id is not None and payload.parent_task_id != task_id:
        raise ValidationAppError("parent_task_id must match task_id")
    child = await TaskService(session).create_task(
        current_user.id, payload.model_copy(update={"parent_task_id": task_id})
    )
    return TaskResponse.model_validate(child)


@router.get("/{task_id}/subtasks", response_model=list[TaskResponse])
async def list_subtasks(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> list[TaskResponse]:
    items = await TaskService(session).list_subtasks(current_user.id, task_id)
    return [TaskResponse.model_validate(item) for item in items]


@router.get("/{task_id}/occurrences", response_model=list[TaskOccurrenceResponse])
async def list_task_occurrences(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> list[TaskOccurrenceResponse]:
    items = await TaskService(session).list_task_occurrences(current_user.id, task_id)
    return [TaskOccurrenceResponse.model_validate(item) for item in items]


@router.post("/{task_id}/recurrence", response_model=RecurrenceRuleResponse, status_code=201)
async def create_recurrence(
    task_id: UUID, payload: RecurrenceRuleRequest, current_user: CurrentUser, session: DBSession
) -> RecurrenceRuleResponse:
    rule = await RecurrenceService(session).create_rule(current_user.id, task_id, payload)
    return RecurrenceRuleResponse.model_validate(rule)


@router.get("/{task_id}/recurrence", response_model=RecurrenceRuleResponse)
async def get_recurrence(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> RecurrenceRuleResponse:
    rule = await RecurrenceService(session).get_rule(current_user.id, task_id)
    return RecurrenceRuleResponse.model_validate(rule)


@router.get("/{task_id}/recurrence/preview", response_model=RecurrencePreviewResponse)
async def preview_recurrence(
    task_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    count: int = Query(default=10, ge=1, le=100),
) -> RecurrencePreviewResponse:
    dates = await RecurrenceService(session).preview(current_user.id, task_id, count)
    return RecurrencePreviewResponse(task_id=task_id, dates=dates)


@router.post("/{task_id}/recurrence/generate", response_model=RecurrenceGenerationResponse)
async def generate_recurrence(
    task_id: UUID,
    through: date,
    current_user: CurrentUser,
    session: DBSession,
) -> RecurrenceGenerationResponse:
    generated = await RecurrenceService(session).generate(current_user.id, task_id, through)
    return RecurrenceGenerationResponse(task_id=task_id, generated_count=generated, through=through)


@router.put("/{task_id}/recurrence/future", response_model=RecurrenceRuleResponse)
async def edit_future_recurrence(
    task_id: UUID, payload: RecurrenceEditRequest, current_user: CurrentUser, session: DBSession
) -> RecurrenceRuleResponse:
    rule = await RecurrenceService(session).edit_future(current_user.id, task_id, payload)
    return RecurrenceRuleResponse.model_validate(rule)


@router.post("/{task_id}/recurrence/pause", response_model=RecurrenceRuleResponse)
async def pause_recurrence(
    task_id: UUID,
    expected_rule_version: int,
    current_user: CurrentUser,
    session: DBSession,
) -> RecurrenceRuleResponse:
    rule = await RecurrenceService(session).set_paused(
        current_user.id, task_id, True, expected_rule_version
    )
    return RecurrenceRuleResponse.model_validate(rule)


@router.post("/{task_id}/recurrence/resume", response_model=RecurrenceRuleResponse)
async def resume_recurrence(
    task_id: UUID,
    expected_rule_version: int,
    current_user: CurrentUser,
    session: DBSession,
) -> RecurrenceRuleResponse:
    rule = await RecurrenceService(session).set_paused(
        current_user.id, task_id, False, expected_rule_version
    )
    return RecurrenceRuleResponse.model_validate(rule)


@router.get("/{task_id}/checklist", response_model=list[ChecklistItemResponse])
async def list_checklist(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> list[ChecklistItemResponse]:
    items = await WorkflowService(session).list_checklist(current_user.id, task_id)
    return [ChecklistItemResponse.model_validate(item) for item in items]


@router.post("/{task_id}/checklist", response_model=ChecklistItemResponse, status_code=201)
async def create_checklist(
    task_id: UUID,
    payload: ChecklistCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> ChecklistItemResponse:
    item = await WorkflowService(session).create_checklist(current_user.id, task_id, payload)
    return ChecklistItemResponse.model_validate(item)


@router.patch("/{task_id}/checklist/{item_id}", response_model=ChecklistItemResponse)
async def patch_checklist(
    task_id: UUID,
    item_id: UUID,
    payload: ChecklistPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> ChecklistItemResponse:
    item = await WorkflowService(session).patch_checklist(
        current_user.id, task_id, item_id, payload
    )
    return ChecklistItemResponse.model_validate(item)


@router.get("/{task_id}/dependencies", response_model=list[TaskDependencyResponse])
async def list_dependencies(
    task_id: UUID, current_user: CurrentUser, session: DBSession
) -> list[TaskDependencyResponse]:
    items = await WorkflowService(session).list_dependencies(current_user.id, task_id)
    return [TaskDependencyResponse.model_validate(item) for item in items]


@router.post("/{task_id}/dependencies", response_model=TaskDependencyResponse, status_code=201)
async def create_dependency(
    task_id: UUID,
    payload: DependencyCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> TaskDependencyResponse:
    item = await WorkflowService(session).add_dependency(
        current_user.id, task_id, payload.blocking_task_id
    )
    return TaskDependencyResponse.model_validate(item)


@router.delete("/{task_id}/dependencies/{dependency_id}", status_code=204)
async def delete_dependency(
    task_id: UUID,
    dependency_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    await WorkflowService(session).remove_dependency(current_user.id, task_id, dependency_id)
