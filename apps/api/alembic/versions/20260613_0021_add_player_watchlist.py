"""add player watchlist table

Revision ID: 20260613_0021
Revises: 20260611_0020
Create Date: 2026-06-13

"""

import sqlalchemy as sa
from alembic import op

revision = "20260613_0021"
down_revision = "20260611_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "player_watchlists",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "league_id", "player_id",
            name="uq_player_watchlists_user_league_player",
        ),
    )
    op.create_index("ix_player_watchlists_user_id", "player_watchlists", ["user_id"])
    op.create_index("ix_player_watchlists_league_id", "player_watchlists", ["league_id"])
    op.create_index("ix_player_watchlists_player_id", "player_watchlists", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_player_watchlists_player_id", "player_watchlists")
    op.drop_index("ix_player_watchlists_league_id", "player_watchlists")
    op.drop_index("ix_player_watchlists_user_id", "player_watchlists")
    op.drop_table("player_watchlists")
