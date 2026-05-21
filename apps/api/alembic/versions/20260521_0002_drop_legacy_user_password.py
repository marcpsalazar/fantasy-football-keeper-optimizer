"""Drop legacy plaintext user password column.

Revision ID: 20260521_0002
Revises: 20260521_0001
Create Date: 2026-05-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260521_0002"
down_revision = "20260521_0001"
branch_labels = None
depends_on = None


def has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not has_column("users", "password"):
        return

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("password")


def downgrade() -> None:
    if has_column("users", "password"):
        return

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("password", sa.String(length=255), nullable=True))
