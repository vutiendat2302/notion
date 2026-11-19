from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16

if TYPE_CHECKING:
    from app.modules.tasks.models.task_occurrence import TaskOccurrence


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_tasks_user_id"),
        CheckConstraint(
            "priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')",
            name="tasks_priority",
        ),
        CheckConstraint(
            "parent_task_id IS NULL OR parent_task_id <> id",
            name="tasks_no_self_parent",
        ),
        Index(
            "ix_tasks_user_id_archived_at_created_at",
            "user_id",
            "archived_at",
            "created_at",
        ),
        Index("ix_tasks_user_id_project_id", "user_id", "project_id"),
        Index("ix_tasks_parent_task_id", "parent_task_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    project_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    parent_task_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        String(16), nullable=False, default="MEDIUM", server_default=text("'MEDIUM'")
    )
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    is_recurring: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    occurrences: Mapped[list[TaskOccurrence]] = relationship(
        back_populates="task",
        lazy="selectin",
    )
