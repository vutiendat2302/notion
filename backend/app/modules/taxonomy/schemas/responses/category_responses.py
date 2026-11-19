from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    accent_token: str
    sort_order: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
