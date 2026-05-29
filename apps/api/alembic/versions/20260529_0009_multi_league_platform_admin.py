"""Multi-league support: platform_admin role, league_memberships table, per-league avatars.

Revision ID: 20260529_0009
Revises: 20260528_0008
Create Date: 2026-05-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260529_0009"
down_revision = "20260528_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A. Rename existing "admin" role values to "platform_admin".
    # users.role is VARCHAR(40) with no CHECK constraint; the index stays valid.
    op.execute("UPDATE users SET role = 'platform_admin' WHERE role = 'admin'")

    # B. Add created_by_user_id (nullable) to leagues.
    op.add_column("leagues", sa.Column("created_by_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_leagues_created_by_user_id",
        "leagues",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_leagues_created_by_user_id", "leagues", ["created_by_user_id"])

    # C. Create league_memberships table.
    op.create_table(
        "league_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("avatar_data_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "league_id", name="uq_league_memberships_user_league"),
    )
    op.create_index("ix_league_memberships_user_id", "league_memberships", ["user_id"])
    op.create_index("ix_league_memberships_league_id", "league_memberships", ["league_id"])
    op.create_index("ix_league_memberships_role", "league_memberships", ["role"])

    # D. Seed memberships: all platform_admin users become league_admin of every existing league.
    op.execute("""
        INSERT INTO league_memberships (id, user_id, league_id, role, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            u.id,
            l.id,
            'league_admin',
            NOW(),
            NOW()
        FROM users u
        CROSS JOIN leagues l
        WHERE u.role = 'platform_admin'
        ON CONFLICT (user_id, league_id) DO NOTHING
    """)


def downgrade() -> None:
    # Reverse C — drop memberships table (CASCADE FKs clean up automatically).
    op.drop_index("ix_league_memberships_role", table_name="league_memberships")
    op.drop_index("ix_league_memberships_league_id", table_name="league_memberships")
    op.drop_index("ix_league_memberships_user_id", table_name="league_memberships")
    op.drop_table("league_memberships")

    # Reverse B — drop FK and column on leagues.
    op.drop_index("ix_leagues_created_by_user_id", table_name="leagues")
    op.drop_constraint("fk_leagues_created_by_user_id", "leagues", type_="foreignkey")
    op.drop_column("leagues", "created_by_user_id")

    # Reverse A — revert platform_admin back to admin.
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'platform_admin'")
