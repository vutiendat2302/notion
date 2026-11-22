"""user roles and unique phone

Revision ID: 0004_user_roles_unique_phone
Revises: 818a88551072
Create Date: 2026-11-22 12:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_user_roles_unique_phone"
down_revision: str | Sequence[str] | None = "818a88551072"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=254),
        nullable=True,
    )
    op.alter_column(
        "users",
        "email_normalized",
        existing_type=sa.String(length=254),
        nullable=True,
    )
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("phone_normalized", sa.String(length=20), nullable=True))
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=16), server_default=sa.text("'USER'"), nullable=False),
    )
    op.create_unique_constraint(op.f("uq_users_phone_normalized"), "users", ["phone_normalized"])
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_check_constraint("users_role", "users", "role IN ('ADMIN', 'USER')")
    op.create_check_constraint(
        "users_contact_required",
        "users",
        "email_normalized IS NOT NULL OR phone_normalized IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_users_contact_required"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_users_role"), "users", type_="check")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_constraint(op.f("uq_users_phone_normalized"), "users", type_="unique")
    op.drop_column("users", "role")
    op.drop_column("users", "phone_normalized")
    op.drop_column("users", "phone")
    op.alter_column(
        "users",
        "email_normalized",
        existing_type=sa.String(length=254),
        nullable=False,
    )
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=254),
        nullable=False,
    )
