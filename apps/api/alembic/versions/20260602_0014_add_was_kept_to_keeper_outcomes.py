"""add was_kept to keeper_outcomes

Revision ID: 20260602_0014
Revises: 20260602_0013
Create Date: 2026-06-02

"""

import sqlalchemy as sa
from alembic import op

revision = "20260602_0014"
down_revision = "20260602_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "keeper_outcomes",
        sa.Column(
            "was_kept",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("keeper_outcomes", "was_kept")
