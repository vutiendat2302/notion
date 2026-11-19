from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models.project import Project


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        *,
        status_filter: str | None = None,
        include_archived: bool = False,
    ) -> list[Project]:
        stmt = select(Project).where(Project.user_id == user_id)
        if not include_archived:
            stmt = stmt.where(Project.archived_at.is_(None))
        if status_filter is not None:
            stmt = stmt.where(Project.status == status_filter)
        stmt = stmt.order_by(Project.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id_and_user(self, project_id: UUID, user_id: UUID) -> Project | None:
        stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, project: Project) -> Project:
        self.session.add(project)
        await self.session.flush()
        return project
