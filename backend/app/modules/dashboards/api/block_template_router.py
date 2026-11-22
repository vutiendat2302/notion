from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentAdmin, CurrentUser, DBSession
from app.modules.dashboards.schemas.dashboard_schemas import (
    BlockTemplateCreateRequest,
    BlockTemplatePatchRequest,
    BlockTemplateResponse,
)
from app.modules.dashboards.services.block_template_service import BlockTemplateService

router = APIRouter(tags=["block-templates"])


@router.get("/block-templates", response_model=list[BlockTemplateResponse])
async def list_active_block_templates(
    _: CurrentUser,
    session: DBSession,
) -> list[BlockTemplateResponse]:
    return await BlockTemplateService(session).list_templates(active_only=True)


@router.get("/admin/block-templates", response_model=list[BlockTemplateResponse])
async def admin_list_block_templates(
    _: CurrentAdmin,
    session: DBSession,
) -> list[BlockTemplateResponse]:
    return await BlockTemplateService(session).list_templates(active_only=False)


@router.post(
    "/admin/block-templates",
    response_model=BlockTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_block_template(
    payload: BlockTemplateCreateRequest,
    _: CurrentAdmin,
    session: DBSession,
) -> BlockTemplateResponse:
    return await BlockTemplateService(session).create_template(payload)


@router.patch("/admin/block-templates/{template_id}", response_model=BlockTemplateResponse)
async def admin_patch_block_template(
    template_id: UUID,
    payload: BlockTemplatePatchRequest,
    _: CurrentAdmin,
    session: DBSession,
) -> BlockTemplateResponse:
    return await BlockTemplateService(session).patch_template(template_id, payload)


@router.delete("/admin/block-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_block_template(
    template_id: UUID,
    _: CurrentAdmin,
    session: DBSession,
) -> None:
    await BlockTemplateService(session).delete_template(template_id)
