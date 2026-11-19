from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    category_id: UUID | None
    status: str
    start_date: date | None
    target_date: date | None
    version: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
