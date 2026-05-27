"""Add mock draft tables.

Revision ID: 20260524_0004
Revises: 20260521_0003
Create Date: 2026-05-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260524_0004"
down_revision: str | None = "20260521_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.JSONB(astext_type=sa.Text())
    return sa.JSON()


def upgrade() -> None:
    json_type = _json_type()
    op.create_table(
        "mock_draft_sessions",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("user_team_id", sa.Uuid(), nullable=False),
        sa.Column("adp_snapshot_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("pick_timer_seconds", sa.Integer(), nullable=True),
        sa.Column("bot_config", json_type, nullable=False),
        sa.Column("keeper_context", json_type, nullable=False),
        sa.Column("draft_type", sa.String(length=40), nullable=False),
        sa.Column("round_count", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["adp_snapshot_id"], ["adp_snapshots.id"]),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mock_draft_sessions_adp_snapshot_id", "mock_draft_sessions", ["adp_snapshot_id"])
    op.create_index("ix_mock_draft_sessions_completed_at", "mock_draft_sessions", ["completed_at"])
    op.create_index("ix_mock_draft_sessions_league_id", "mock_draft_sessions", ["league_id"])
    op.create_index("ix_mock_draft_sessions_status", "mock_draft_sessions", ["status"])
    op.create_index("ix_mock_draft_sessions_user_id", "mock_draft_sessions", ["user_id"])
    op.create_index("ix_mock_draft_sessions_user_team_id", "mock_draft_sessions", ["user_team_id"])

    op.create_table(
        "mock_draft_picks",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("pick_in_round", sa.Integer(), nullable=False),
        sa.Column("overall_pick", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("decision_time_ms", sa.Integer(), nullable=True),
        sa.Column("bot_personality", sa.String(length=80), nullable=True),
        sa.Column("bot_difficulty", sa.String(length=40), nullable=True),
        sa.Column("reasoning_summary", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["mock_draft_sessions.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "overall_pick", name="uq_mock_draft_picks_session_overall"),
    )
    op.create_index("ix_mock_draft_picks_overall_pick", "mock_draft_picks", ["overall_pick"])
    op.create_index("ix_mock_draft_picks_pick_in_round", "mock_draft_picks", ["pick_in_round"])
    op.create_index("ix_mock_draft_picks_player_id", "mock_draft_picks", ["player_id"])
    op.create_index("ix_mock_draft_picks_round", "mock_draft_picks", ["round"])
    op.create_index("ix_mock_draft_picks_session_id", "mock_draft_picks", ["session_id"])
    op.create_index("ix_mock_draft_picks_source", "mock_draft_picks", ["source"])
    op.create_index("ix_mock_draft_picks_team_id", "mock_draft_picks", ["team_id"])

    op.create_table(
        "mock_draft_analyses",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("overall_letter_grade", sa.String(length=4), nullable=False),
        sa.Column("overall_numeric_score", sa.Integer(), nullable=False),
        sa.Column("summary", sa.String(length=2000), nullable=False),
        sa.Column("strengths", json_type, nullable=False),
        sa.Column("weaknesses", json_type, nullable=False),
        sa.Column("pick_feedback", json_type, nullable=False),
        sa.Column("what_if_scenarios", json_type, nullable=False),
        sa.Column("projected_rankings", json_type, nullable=False),
        sa.Column("future_advice", json_type, nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["mock_draft_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index("ix_mock_draft_analyses_overall_numeric_score", "mock_draft_analyses", ["overall_numeric_score"])
    op.create_index("ix_mock_draft_analyses_session_id", "mock_draft_analyses", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_mock_draft_analyses_session_id", table_name="mock_draft_analyses")
    op.drop_index("ix_mock_draft_analyses_overall_numeric_score", table_name="mock_draft_analyses")
    op.drop_table("mock_draft_analyses")
    op.drop_index("ix_mock_draft_picks_team_id", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_source", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_session_id", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_round", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_player_id", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_pick_in_round", table_name="mock_draft_picks")
    op.drop_index("ix_mock_draft_picks_overall_pick", table_name="mock_draft_picks")
    op.drop_table("mock_draft_picks")
    op.drop_index("ix_mock_draft_sessions_user_team_id", table_name="mock_draft_sessions")
    op.drop_index("ix_mock_draft_sessions_user_id", table_name="mock_draft_sessions")
    op.drop_index("ix_mock_draft_sessions_status", table_name="mock_draft_sessions")
    op.drop_index("ix_mock_draft_sessions_league_id", table_name="mock_draft_sessions")
    op.drop_index("ix_mock_draft_sessions_completed_at", table_name="mock_draft_sessions")
    op.drop_index("ix_mock_draft_sessions_adp_snapshot_id", table_name="mock_draft_sessions")
    op.drop_table("mock_draft_sessions")
