"""user avatar_file_id, user_settings preferences_json, time_entry planned_duration_seconds

Revision ID: 0006_avatar_prefs_timer
Revises: 0005_add_username_to_users
Create Date: 2026-11-22 14:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.db.types import UUIDBinary16

# revision identifiers, used by Alembic.
revision: str = "0006_avatar_prefs_timer"
down_revision: str | Sequence[str] | None = "0005_add_username_to_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_file_id", UUIDBinary16(), nullable=True))
    op.add_column("user_settings", sa.Column("preferences_json", sa.JSON(), nullable=True))
    op.add_column(
        "time_entries",
        sa.Column("planned_duration_seconds", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("time_entries", "planned_duration_seconds")
    op.drop_column("user_settings", "preferences_json")
    op.drop_column("users", "avatar_file_id")
