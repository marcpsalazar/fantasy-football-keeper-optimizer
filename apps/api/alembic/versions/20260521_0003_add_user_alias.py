"""Add user alias for owner display names.

Revision ID: 20260521_0003
Revises: 20260521_0002
Create Date: 2026-05-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260521_0003"
down_revision: str | None = "20260521_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "alias" in columns:
        return
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("alias", sa.String(length=120), nullable=True))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "alias" not in columns:
        return
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("alias")
