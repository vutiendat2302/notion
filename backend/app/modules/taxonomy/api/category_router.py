from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.taxonomy.schemas.requests.category_requests import (
    CategoryCreateRequest,
    CategoryPatchRequest,
)
from app.modules.taxonomy.schemas.responses.category_responses import CategoryResponse
from app.modules.taxonomy.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser,
    session: DBSession,
    include_archived: bool = False,
) -> list[CategoryResponse]:
    items = await CategoryService(session).list_categories(
        current_user.id, include_archived=include_archived
    )
    return [CategoryResponse.model_validate(item) for item in items]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreateRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> CategoryResponse:
    category = await CategoryService(session).create_category(current_user.id, payload)
    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def patch_category(
    category_id: UUID,
    payload: CategoryPatchRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> CategoryResponse:
    category = await CategoryService(session).patch_category(current_user.id, category_id, payload)
    return CategoryResponse.model_validate(category)
