from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

StorageFolder = Literal["avatars", "sounds/countdown", "sounds/finish", "attachments", "ai-uploads"]


class FileRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bucket: str
    object_key: str
    original_filename: str
    mime_type: str
    size_bytes: int
    status: str
    stream_url: str
    created_at: datetime


class SoundOptionResponse(BaseModel):
    id: str
    kind: Literal["countdown", "finish"]
    name: str
    stream_url: str
    is_default: bool = False


class SoundCatalogResponse(BaseModel):
    defaults: list[SoundOptionResponse]
    custom: list[SoundOptionResponse]
