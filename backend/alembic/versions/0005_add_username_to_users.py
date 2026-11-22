"""add username to users

Revision ID: 0005_add_username_to_users
Revises: 0004_user_roles_unique_phone
Create Date: 2026-11-22 13:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_add_username_to_users"
down_revision: str | Sequence[str] | None = "0004_user_roles_unique_phone"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=50), nullable=True))
    op.add_column(
        "users", sa.Column("username_normalized", sa.String(length=50), nullable=True)
    )
    op.create_unique_constraint(
        op.f("uq_users_username_normalized"), "users", ["username_normalized"]
    )
    op.execute(
        sa.text(
            "UPDATE users SET username = 'admin', username_normalized = 'admin' "
            "WHERE email_normalized = 'admin@dat.local' AND username_normalized IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_constraint(op.f("uq_users_username_normalized"), "users", type_="unique")
    op.drop_column("users", "username_normalized")
    op.drop_column("users", "username")
