import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League
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

    snapshot: "ADPSnapshot" = Relationship(back_populates="entries")
    player: "Player" = Relationship(back_populates="adp_entries")
