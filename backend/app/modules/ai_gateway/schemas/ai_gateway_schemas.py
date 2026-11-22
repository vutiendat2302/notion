from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProposedTaskItem(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    scheduled_date: date | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    status: Literal["NOT_STARTED", "IN_PROGRESS", "DONE"] = "NOT_STARTED"
    project_id: UUID | None = None
    category_id: UUID | None = None
    description: str | None = None


class AIChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    image_file_id: UUID | None = None
    conversation_id: UUID | None = None
    locale: Literal["vi", "en"] = "vi"


class AIChatResponse(BaseModel):
    conversation_id: UUID | None = None
    proposal_id: UUID | None = None
    status: Literal["INFO_ONLY", "AWAITING_CONFIRMATION"] = "INFO_ONLY"
    reply_message: str
    ocr_text: str | None = None
    provider: str = "HYBRID"
    model_id: str = "ai-service"
    proposed_tasks: list[ProposedTaskItem] = []
    citations: list[dict[str, str]] = []


class AIProposalConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_indices: list[int] | None = None
    edited_items: list[ProposedTaskItem] | None = None


class AIProposalConfirmResponse(BaseModel):
    proposal_id: UUID
    status: str
    created_task_ids: list[UUID]
    created_count: int


class AIAgentOption(BaseModel):
    id: Literal["local", "claude", "codex", "gemini"]
    label: str
    model_id: str
    requires_api_key: bool
    server_configured: bool
