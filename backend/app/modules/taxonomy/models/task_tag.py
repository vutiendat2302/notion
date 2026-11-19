from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKeyConstraint, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


class TaskTag(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_tags"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "task_id"], ["tasks.user_id", "tasks.id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["user_id", "tag_id"], ["tags.user_id", "tags.id"], ondelete="CASCADE"
        ),
        UniqueConstraint("task_id", "tag_id", name="uq_task_tags_task_tag"),
        Index("ix_task_tags_user_tag", "user_id", "tag_id"),
    )

    user_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    task_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    tag_id: Mapped[UUID] = mapped_column(UUIDBinary16(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
