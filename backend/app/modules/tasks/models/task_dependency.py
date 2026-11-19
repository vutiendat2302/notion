from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


class TaskDependency(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        CheckConstraint("blocking_task_id <> blocked_task_id", name="task_dependencies_no_self"),
        CheckConstraint(
            "relation_type IN ('FINISH_TO_START')", name="task_dependencies_relation_type"
        ),
        ForeignKeyConstraint(
            ["user_id", "blocking_task_id"],
            ["tasks.user_id", "tasks.id"],
            name="fk_task_dependencies_blocking_owner",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["user_id", "blocked_task_id"],
            ["tasks.user_id", "tasks.id"],
            name="fk_task_dependencies_blocked_owner",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "user_id", "blocking_task_id", "blocked_task_id", name="uq_task_dependencies_edge"
        ),
        Index("ix_task_dependencies_user_blocked", "user_id", "blocked_task_id"),
    )

    user_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    blocking_task_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    blocked_task_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    relation_type: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="FINISH_TO_START",
        server_default=text("'FINISH_TO_START'"),
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
