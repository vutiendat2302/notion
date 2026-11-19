from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.db.base import utc_now
from app.modules.projects.models.project import Project
from app.modules.projects.repositories.project_repository import ProjectRepository
from app.modules.projects.schemas.requests.project_requests import (
    ProjectCreateRequest,
    ProjectPatchRequest,
)
from app.modules.taxonomy.repositories.category_repository import CategoryRepository


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)
        self.category_repo = CategoryRepository(session)

    async def list_projects(
        self,
        user_id: UUID,
        *,
        status_filter: str | None = None,
        include_archived: bool = False,
    ) -> list[Project]:
        return await self.repo.list_by_user(
            user_id,
            status_filter=status_filter,
            include_archived=include_archived,
        )

    async def create_project(self, user_id: UUID, payload: ProjectCreateRequest) -> Project:
        if payload.category_id is not None:
            category = await self.category_repo.get_by_id_and_user(payload.category_id, user_id)
            if category is None:
                raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        if payload.start_date and payload.target_date and payload.target_date < payload.start_date:
            raise ValidationAppError("target_date cannot be earlier than start_date.")

        project = Project(
            user_id=user_id,
            category_id=payload.category_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            start_date=payload.start_date,
            target_date=payload.target_date,
        )
        await self.repo.add(project)
        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def patch_project(
        self, user_id: UUID, project_id: UUID, payload: ProjectPatchRequest
    ) -> Project:
        project = await self.repo.get_by_id_and_user(project_id, user_id)
        if project is None:
            raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")

        if payload.expected_version is not None and payload.expected_version != project.version:
            raise ConflictError(
                "Project was modified concurrently.",
                code="PROJECT_CONFLICT",
                details={
                    "expected_version": payload.expected_version,
                    "actual_version": project.version,
                },
            )

        fields_set = payload.model_fields_set
        if "category_id" in fields_set and payload.category_id is not None:
            category = await self.category_repo.get_by_id_and_user(payload.category_id, user_id)
            if category is None:
                raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        for field_name in ("title", "status"):
            if field_name in fields_set:
                value = getattr(payload, field_name)
                if value is None:
                    raise ValidationAppError(f"Field '{field_name}' cannot be null.")
                setattr(project, field_name, value)

        for nullable_field in ("description", "category_id", "start_date", "target_date"):
            if nullable_field in fields_set:
                setattr(project, nullable_field, getattr(payload, nullable_field))

        if project.start_date and project.target_date and project.target_date < project.start_date:
            raise ValidationAppError("target_date cannot be earlier than start_date.")

        if "archived" in fields_set:
            if payload.archived is None:
                raise ValidationAppError("Field 'archived' cannot be null.")
            project.archived_at = utc_now() if payload.archived else None

        project.version += 1
        await self.session.commit()
        await self.session.refresh(project)
        return project
