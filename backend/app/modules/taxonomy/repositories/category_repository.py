from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.taxonomy.models.category import Category


class CategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(self, user_id: UUID, include_archived: bool = False) -> list[Category]:
        stmt = select(Category).where(Category.user_id == user_id)
        if not include_archived:
            stmt = stmt.where(Category.archived_at.is_(None))
        stmt = stmt.order_by(Category.sort_order.asc(), Category.created_at.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id_and_user(self, category_id: UUID, user_id: UUID) -> Category | None:
        stmt = select(Category).where(Category.id == category_id, Category.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, category: Category) -> Category:
        self.session.add(category)
        await self.session.flush()
        return category
