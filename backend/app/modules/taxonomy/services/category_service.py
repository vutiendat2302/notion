from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationAppError
from app.db.base import utc_now
from app.modules.taxonomy.models.category import Category
from app.modules.taxonomy.repositories.category_repository import CategoryRepository
from app.modules.taxonomy.schemas.requests.category_requests import (
    CategoryCreateRequest,
    CategoryPatchRequest,
)


class CategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CategoryRepository(session)

    async def list_categories(
        self, user_id: UUID, include_archived: bool = False
    ) -> list[Category]:
        return await self.repo.list_by_user(user_id, include_archived=include_archived)

    async def create_category(self, user_id: UUID, payload: CategoryCreateRequest) -> Category:
        category = Category(
            user_id=user_id,
            name=payload.name,
            accent_token=payload.accent_token,
            sort_order=payload.sort_order,
        )
        await self.repo.add(category)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def patch_category(
        self, user_id: UUID, category_id: UUID, payload: CategoryPatchRequest
    ) -> Category:
        category = await self.repo.get_by_id_and_user(category_id, user_id)
        if category is None:
            raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        fields_set = payload.model_fields_set
        for field_name in ("name", "accent_token", "sort_order"):
            if field_name in fields_set:
                value = getattr(payload, field_name)
                if value is None:
                    raise ValidationAppError(f"Field '{field_name}' cannot be null.")
                setattr(category, field_name, value)

        if "archived" in fields_set:
            if payload.archived is None:
                raise ValidationAppError("Field 'archived' cannot be null.")
            category.archived_at = utc_now() if payload.archived else None

        await self.session.commit()
        await self.session.refresh(category)
        return category
