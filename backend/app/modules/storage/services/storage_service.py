import hashlib
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AppError, NotFoundError, ValidationAppError
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import files
from app.modules.storage.schemas.storage_schemas import (
    FileRecordResponse,
    SoundCatalogResponse,
    SoundOptionResponse,
    StorageFolder,
)
from app.modules.storage.services.minio_client import MinioS3Client

_MAX_FILE_BYTES = 25 * 1024 * 1024

_ALLOWED_MIME: dict[StorageFolder, set[str]] = {
    "avatars": {"image/png", "image/jpeg", "image/webp", "image/gif"},
    "sounds/countdown": {
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "video/mp4",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/webm",
        "audio/x-m4a",
        "audio/aac",
    },
    "sounds/finish": {
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "video/mp4",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/webm",
        "audio/x-m4a",
        "audio/aac",
    },
    "attachments": {
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/markdown",
    },
    "ai-uploads": {"image/png", "image/jpeg", "image/webp", "application/pdf"},
}

_EXT_FALLBACK_MIME: dict[str, str] = {
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".m4a": "audio/x-m4a",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def get_minio_client() -> MinioS3Client:
    return MinioS3Client()


def to_file_response(row: Any) -> FileRecordResponse:
    file_id = row.id
    return FileRecordResponse(
        id=file_id,
        bucket=row.bucket,
        object_key=row.object_key,
        original_filename=row.original_filename,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        status=row.status,
        stream_url=f"/api/v1/storage/files/{file_id}/stream",
        created_at=row.created_at,
    )


class StorageService:
    def __init__(self, session: AsyncSession, minio_client: MinioS3Client | None = None) -> None:
        self.session = session
        self.minio = minio_client or get_minio_client()

    async def upload_file(
        self,
        *,
        user_id: UUID,
        folder: StorageFolder,
        filename: str,
        content_type: str | None,
        data: bytes,
    ) -> FileRecordResponse:
        if not data:
            raise ValidationAppError("Tệp tải lên không được rỗng.", code="EMPTY_FILE")
        if len(data) > _MAX_FILE_BYTES:
            raise ValidationAppError("Dung lượng tệp tối đa là 25 MB.", code="FILE_TOO_LARGE")

        clean_name = Path(filename or "upload.bin").name[:255]
        ext = Path(clean_name).suffix.lower()
        resolved_mime = (content_type or "").split(";")[0].strip().lower()
        if not resolved_mime or resolved_mime == "application/octet-stream":
            resolved_mime = _EXT_FALLBACK_MIME.get(ext, resolved_mime or "application/octet-stream")

        if resolved_mime not in _ALLOWED_MIME[folder]:
            raise ValidationAppError(
                f"Định dạng tệp '{resolved_mime}' không được hỗ trợ cho mục '{folder}'.",
                code="UNSUPPORTED_MEDIA_TYPE",
            )

        settings = get_settings()
        file_id = new_uuid7()
        # Immutable identity key: never use mutable username in object key.
        object_key = f"users/{user_id}/{folder}/{file_id}"
        sha256_hex = hashlib.sha256(data).hexdigest()

        try:
            await self.minio.put_object(
                settings.minio_bucket_uploads,
                object_key,
                data,
                resolved_mime,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                status_code=503,
                code="STORAGE_UNAVAILABLE",
                message="Không thể kết nối tới dịch vụ lưu trữ MinIO.",
            ) from exc

        now = utc_now()
        await self.session.execute(
            insert(files).values(
                id=file_id,
                user_id=user_id,
                bucket=settings.minio_bucket_uploads,
                object_key=object_key,
                original_filename=clean_name,
                mime_type=resolved_mime,
                size_bytes=len(data),
                sha256_hex=sha256_hex,
                current_version=1,
                status="READY",
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        row = await self._get_owned_file(user_id, file_id)
        return to_file_response(row)

    async def stream_file(
        self,
        *,
        user_id: UUID,
        file_id: UUID,
        range_header: str | None = None,
    ) -> tuple[int, bytes, str, dict[str, str]]:
        row = await self._get_owned_file(user_id, file_id)
        try:
            status_code, content, raw_headers = await self.minio.get_object(
                str(row.bucket),
                str(row.object_key),
                range_header=range_header,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                status_code=503,
                code="STORAGE_UNAVAILABLE",
                message="Không thể đọc tệp từ MinIO.",
            ) from exc

        if status_code == 404:
            raise NotFoundError("File object missing from storage.", code="FILE_NOT_FOUND")

        passthrough: dict[str, str] = {"Accept-Ranges": "bytes"}
        if "content-range" in raw_headers:
            passthrough["Content-Range"] = raw_headers["content-range"]
        if "content-length" in raw_headers:
            passthrough["Content-Length"] = raw_headers["content-length"]
        return status_code, content, str(row.mime_type), passthrough

    async def list_sounds(self, user_id: UUID) -> SoundCatalogResponse:
        prefix = f"users/{user_id}/sounds/"
        stmt = (
            select(files)
            .where(
                files.c.user_id == user_id,
                files.c.status == "READY",
                files.c.object_key.like(f"{prefix}%"),
            )
            .order_by(files.c.created_at.desc())
        )
        rows = (await self.session.execute(stmt)).fetchall()

        defaults = [
            SoundOptionResponse(
                id="default-countdown",
                kind="countdown",
                name="Âm thanh đếm ngược mặc định",
                stream_url="/sounds/default-countdown.wav",
                is_default=True,
            ),
            SoundOptionResponse(
                id="default-finish",
                kind="finish",
                name="Âm thanh báo hết giờ mặc định",
                stream_url="/sounds/default-finish.mp3",
                is_default=True,
            ),
        ]
        custom: list[SoundOptionResponse] = []
        for row in rows:
            kind = "finish" if "/sounds/finish/" in str(row.object_key) else "countdown"
            custom.append(
                SoundOptionResponse(
                    id=str(row.id),
                    kind=kind,
                    name=str(row.original_filename),
                    stream_url=f"/api/v1/storage/files/{row.id}/stream",
                    is_default=False,
                )
            )
        return SoundCatalogResponse(defaults=defaults, custom=custom)

    async def delete_file(self, *, user_id: UUID, file_id: UUID) -> None:
        row = await self._get_owned_file(user_id, file_id)
        try:
            await self.minio.delete_object(str(row.bucket), str(row.object_key))
        except httpx.HTTPError:
            pass
        await self.session.execute(
            update(files)
            .where(files.c.id == file_id, files.c.user_id == user_id)
            .values(status="DELETED", updated_at=utc_now())
        )
        await self.session.commit()

    async def _get_owned_file(self, user_id: UUID, file_id: UUID) -> Any:
        stmt = select(files).where(
            files.c.id == file_id,
            files.c.user_id == user_id,
            files.c.status == "READY",
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            raise NotFoundError("File not found.", code="FILE_NOT_FOUND")
        return row
