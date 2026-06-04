import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League
    from app.models.mock_draft import MockDraftSession
    from app.models.player import Player


class ADPSnapshot(TimestampMixin, table=True):
    __tablename__ = "adp_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "league_id",
            "season_year",
            "source",
            "format_type",
            "snapshot_date",
            name="uq_adp_snapshots_league_source_format_date",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    season_year: int = Field(index=True)
    name: str = Field(index=True, max_length=160)
    source: str = Field(index=True, max_length=120)
    format_type: str = Field(default="superflex", index=True, max_length=80)
    snapshot_date: date = Field(index=True)
    notes: str | None = Field(default=None, max_length=500)

    league: "League" = Relationship(back_populates="adp_snapshots")
    entries: list["ADPEntry"] = Relationship(back_populates="snapshot")
    mock_draft_sessions: list["MockDraftSession"] = Relationship(back_populates="adp_snapshot")


class ADPEntry(TimestampMixin, table=True):
    __tablename__ = "adp_entries"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "player_id", name="uq_adp_entries_snapshot_player"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    snapshot_id: uuid.UUID = Field(foreign_key="adp_snapshots.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    position: str = Field(index=True, max_length=10)
    adp_pick: float = Field(index=True)
    adp_round: float | None = Field(default=None)
    source_note: str | None = Field(default=None, max_length=500)
    sos: float | None = Field(default=None)
    injury: float | None = Field(default=None)
    risk: float | None = Field(default=None)
    floor_projection: float | None = Field(default=None)
    consensus_projection: float | None = Field(default=None)
    draftsharks_projection: float | None = Field(default=None)
    ceiling_projection: float | None = Field(default=None)
    draftsharks_3d_value: float | None = Field(default=None)
    auction_value: float | None = Field(default=None)

    snapshot: "ADPSnapshot" = Relationship(back_populates="entries")
    player: "Player" = Relationship(back_populates="adp_entries")


class ADPRefreshCandidate(TimestampMixin, table=True):
    __tablename__ = "adp_refresh_candidates"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    provider: str = Field(index=True, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    status: str = Field(default="pending", index=True, max_length=40)
    board_size: int = Field(default=250)
    generated_at: str = Field(index=True, max_length=80)
    source_summary: str | None = Field(default=None, max_length=1000)
    warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    normalized_rows: list[dict[str, object]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    error_message: str | None = Field(default=None, max_length=1000)
    approved_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    approved_at: str | None = Field(default=None, max_length=80)
