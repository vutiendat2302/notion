from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

GoalType = Literal[
    "QUANTITATIVE",
    "COUNT_BASED",
    "HABIT_BASED",
    "TASK_BASED",
    "MILESTONE_BASED",
    "QUALITATIVE",
]
GoalStatus = Literal["NOT_STARTED", "ACTIVE", "ON_HOLD", "ACHIEVED", "CANCELLED"]


class GoalCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    goal_type: GoalType = "TASK_BASED"
    metric_unit: str = Field(default="tasks", min_length=1, max_length=32)
    target_value: Decimal = Field(default=Decimal("10"), gt=0)
    baseline_value: Decimal = Field(default=Decimal("0"))
    measurement_mode: Literal["AUTO", "MANUAL", "HYBRID"] = "HYBRID"
    start_date: date
    end_date: date
    status: GoalStatus = "ACTIVE"

    @model_validator(mode="after")
    def validate_dates(self) -> GoalCreateRequest:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date.")
        return self


class GoalPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    target_value: Decimal | None = Field(default=None, gt=0)
    status: GoalStatus | None = None
    end_date: date | None = None
    archived: bool | None = None
    expected_version: int | None = Field(default=None, ge=1)


class GoalMilestoneCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    target_date: date | None = None
    sort_order: int = Field(default=0, ge=0)


class GoalMilestonePatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    target_date: date | None = None
    status: Literal["PENDING", "COMPLETED"] | None = None


class GoalMeasurementCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    measured_value: Decimal
    note: str | None = Field(default=None, max_length=500)
    idempotency_key: str | None = Field(default=None, max_length=128)


class GoalLinkCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID | None = None
    task_id: UUID | None = None
    weight: Decimal = Field(default=Decimal("1.0000"), gt=0)

    @model_validator(mode="after")
    def validate_xor(self) -> GoalLinkCreateRequest:
        if (self.project_id is None) == (self.task_id is None):
            raise ValueError("Provide exactly one of project_id or task_id.")
        return self


class GoalMilestoneResponse(BaseModel):
    id: UUID
    goal_id: UUID
    title: str
    target_date: date | None
    status: str
    completed_at: datetime | None
    sort_order: int


class GoalLinkResponse(BaseModel):
    id: UUID
    goal_id: UUID
    project_id: UUID | None
    task_id: UUID | None
    target_key: str


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    category_id: UUID | None
    goal_type: str
    metric_unit: str
    target_value: Decimal
    baseline_value: Decimal
    measurement_mode: str
    start_date: date
    end_date: date
    status: str
    version: int
    current_value: Decimal = Decimal("0")
    progress_percent: float = 0.0
    milestones: list[GoalMilestoneResponse] = []
    links: list[GoalLinkResponse] = []
    archived_at: datetime | None
    created_at: datetime
