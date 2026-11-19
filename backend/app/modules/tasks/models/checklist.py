from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


class ChecklistItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "checklist_items"
    __table_args__ = (
        Index(
            "ix_checklist_items_task_id_archived_at_sort_order",
            "task_id",
            "archived_at",
            "sort_order",
        ),
    )

    task_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class OccurrenceChecklistState(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "occurrence_checklist_states"
    __table_args__ = (
        UniqueConstraint(
            "occurrence_id",
            "checklist_item_id",
            name="uq_occurrence_checklist_states_occ_item",
        ),
    )

    occurrence_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("task_occurrences.id", ondelete="CASCADE"), nullable=False
    )
    checklist_item_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("checklist_items.id", ondelete="CASCADE"), nullable=False
    )
    is_checked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, default=utc_now, onupdate=utc_now
    )
