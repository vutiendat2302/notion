from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.planning.domain.periods import PeriodType
from app.modules.tasks.schemas.responses.task_responses import OccurrenceWithTaskResponse

PlanStatus = Literal["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]
Commitment = Literal["PLANNED", "COMMITTED", "OPTIONAL"]
TargetType = Literal["TASK", "OCCURRENCE", "PROJECT", "GOAL"]
RolloverAction = Literal["PIN", "RESCHEDULE"]


class SavedPlanPutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=200)
    focus_summary: str | None = Field(default=None, max_length=10000)
    notes: str | None = Field(default=None, max_length=20000)
    status: PlanStatus = "ACTIVE"
    expected_version: int | None = Field(default=None, ge=1)


class SavedPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    period_type: PeriodType
    period_key: str
    start_date: date
    end_date_exclusive: date
    timezone: str
    title: str | None
    focus_summary: str | None
    notes: str | None
    status: PlanStatus
    closed_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


class PlanItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_type: TargetType
    target_id: UUID
    priority_rank: int = Field(default=0, ge=0)
    commitment: Commitment = "COMMITTED"


class PlanItemPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    priority_rank: int | None = Field(default=None, ge=0)
    commitment: Commitment | None = None

    @model_validator(mode="after")
    def require_change(self) -> PlanItemPatchRequest:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided.")
        return self


class PlanItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    period_id: UUID
    task_id: UUID | None
    occurrence_id: UUID | None
    project_id: UUID | None
    goal_id: UUID | None
    target_key: str
    priority_rank: int
    commitment: Commitment
    created_at: datetime
    updated_at: datetime


class PeriodOverviewResponse(BaseModel):
    user_id: UUID
    period_type: PeriodType
    period_key: str
    start_date: date
    end_date_exclusive: date
    timezone: str
    week_starts_on: int
    saved_plan: SavedPlanResponse | None
    status: str
    plan_items: list[PlanItemResponse]
    occurrences: list[OccurrenceWithTaskResponse]
    overdue_occurrences: list[OccurrenceWithTaskResponse]
    planned_focus_minutes: int
    focus_metric: str = "SUM_ESTIMATED_MINUTES_OF_PERIOD_OCCURRENCES"
    focus_unit: str = "minutes"


class RolloverPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: RolloverAction = "PIN"


class RolloverCandidate(BaseModel):
    occurrence_id: UUID
    task_id: UUID
    title: str
    status: str
    scheduled_date: date | None
    proposed_date: date
    version: int


class RolloverPreviewResponse(BaseModel):
    source_period_type: PeriodType
    source_period_key: str
    target_period_key: str
    target_start_date: date
    action: RolloverAction
    candidates: list[RolloverCandidate]


class RolloverSelection(BaseModel):
    occurrence_id: UUID
    expected_version: int = Field(ge=1)


class RolloverConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_period_type: PeriodType
    source_period_key: str
    action: RolloverAction
    items: list[RolloverSelection] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_occurrences(self) -> RolloverConfirmRequest:
        ids = [item.occurrence_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate occurrence IDs are not allowed.")
        return self


class RolloverConfirmResponse(BaseModel):
    source_period_key: str
    target_period_key: str
    action: RolloverAction
    processed_count: int
    occurrence_ids: list[UUID]
    replayed: bool = False
