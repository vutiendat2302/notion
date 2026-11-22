from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, Response, UploadFile, status

from app.api.dependencies import CurrentUser, DBSession
from app.modules.storage.schemas.storage_schemas import (
    FileRecordResponse,
    SoundCatalogResponse,
    StorageFolder,
)
from app.modules.storage.services.storage_service import StorageService

router = APIRouter(prefix="/storage", tags=["storage"])


@router.post("/upload", response_model=FileRecordResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: CurrentUser,
    session: DBSession,
    file: UploadFile = File(...),
    folder: StorageFolder = Form("attachments"),
) -> FileRecordResponse:
    data = await file.read()
    return await StorageService(session).upload_file(
        user_id=current_user.id,
        folder=folder,
        filename=file.filename or "upload.bin",
        content_type=file.content_type,
        data=data,
    )


@router.get("/sounds", response_model=SoundCatalogResponse)
async def list_sounds(
    current_user: CurrentUser,
    session: DBSession,
) -> SoundCatalogResponse:
    return await StorageService(session).list_sounds(current_user.id)


@router.get("/files/{file_id}/stream")
async def stream_file(
    file_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    status_code, content, mime_type, headers = await StorageService(session).stream_file(
        user_id=current_user.id,
        file_id=file_id,
        range_header=range_header,
    )
    return Response(
        content=content,
        status_code=status_code,
        media_type=mime_type,
        headers=headers,
    )


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> None:
    await StorageService(session).delete_file(user_id=current_user.id, file_id=file_id)
