from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import engine, init_db
from app.models import (
    ADPEntry,
    ADPSnapshot,
    DraftPick,
    FinalRosterEntry,
    League,
    ManualOverride,
    OptimizerSettings,
    Player,
    Team,
)

DEFAULT_LEAGUE_NAME = "Maryland Mayhem"
DEFAULT_FORMAT = "superflex"
SUPPORTED_CSV_FILES = (
    "leagues.csv",
    "teams.csv",
    "players.csv",
    "draft_results.csv",
    "final_rosters.csv",
    "adp.csv",
    "optimizer_settings.csv",
    "manual_overrides.csv",
)


def resolve_sample_data_path(sample_data_path: str | Path | None = None) -> Path:
    settings = get_settings()
    raw_path = Path(sample_data_path or settings.sample_data_path)

    if raw_path.is_absolute():
        return raw_path

    repo_root = Path(__file__).resolve().parents[4]
    api_root = Path(__file__).resolve().parents[2]
    candidates = (
        Path.cwd() / raw_path,
        repo_root / raw_path,
        api_root / raw_path,
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return repo_root / raw_path


def seed_database(
    sample_data_path: str | Path | None = None,
    *,
    create_tables: bool = True,
) -> dict[str, int]:
    if create_tables:
        init_db()

    with Session(engine) as session:
        return seed_sample_data(session, sample_data_path)


def seed_sample_data(
    session: Session,
    sample_data_path: str | Path | None = None,
) -> dict[str, int]:
    base_path = resolve_sample_data_path(sample_data_path)
    rows_by_file = {
        file_name: _read_csv(base_path / file_name)
        for file_name in SUPPORTED_CSV_FILES
        if (base_path / file_name).exists()
    }

    if not rows_by_file:
        return {}

    stats: dict[str, int] = defaultdict(int)
    default_season = _infer_default_season(rows_by_file)
    default_league = _seed_leagues(session, rows_by_file.get("leagues.csv", []), default_season, stats)

    if default_league is None:
        default_league = _get_or_create_league(
            session=session,
            name=DEFAULT_LEAGUE_NAME,
            season_year=default_season,
        )
        stats["leagues"] += 1

    _seed_teams(session, rows_by_file.get("teams.csv", []), default_league, stats)
    _seed_players(session, rows_by_file.get("players.csv", []), stats)
    _seed_draft_results(session, rows_by_file.get("draft_results.csv", []), default_league, stats)
    _seed_final_rosters(session, rows_by_file.get("final_rosters.csv", []), default_league, stats)
    _seed_adp(session, rows_by_file.get("adp.csv", []), default_league, stats)
    _seed_optimizer_settings(
        session,
        rows_by_file.get("optimizer_settings.csv", []),
        default_league,
        stats,
    )
    _seed_manual_overrides(
        session,
        rows_by_file.get("manual_overrides.csv", []),
        default_league,
        stats,
    )

    session.commit()
    return dict(stats)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        return [
            {
                str(key).strip().lower(): str(value or "").strip()
                for key, value in row.items()
                if key is not None
            }
            for row in reader
        ]


def _seed_leagues(
    session: Session,
    rows: list[dict[str, str]],
    default_season: int,
    stats: dict[str, int],
) -> League | None:
    default_league: League | None = None

    for row in rows:
        name = _first(row, "name", "league", default=DEFAULT_LEAGUE_NAME)
        season_year = _int(_first(row, "season_year", "season", "year"), default_season)
        league = _get_or_create_league(
            session=session,
            name=name,
            season_year=season_year,
            scoring_format=_first(row, "scoring_format", "format", default=DEFAULT_FORMAT),
            draft_type=_first(row, "draft_type", default="snake"),
            max_keepers=_int(_first(row, "max_keepers"), 4),
            max_keepers_per_position=_int(_first(row, "max_keepers_per_position"), 2),
            max_qb_keepers=_int(_first(row, "max_qb_keepers"), 1),
            roster_settings=_json_object(_first(row, "roster_settings"), {}),
            keeper_rules=_json_object(_first(row, "keeper_rules"), {}),
        )
        default_league = default_league or league
        stats["leagues"] += 1

    return default_league


def _seed_teams(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    for row in rows:
        team_name = _first(row, "name", "team")
        if not team_name:
            continue

        league = _league_from_row(session, row, default_league)
        _get_or_create_team(
            session=session,
            league=league,
            name=team_name,
            owner_name=_first(row, "owner_name", "owner"),
            draft_slot=_int(_first(row, "draft_slot", "slot"), None),
        )
        stats["teams"] += 1


def _seed_players(session: Session, rows: list[dict[str, str]], stats: dict[str, int]) -> None:
    for row in rows:
        player_name = _first(row, "full_name", "player", "name")
        position = _normalize_position(_first(row, "position"))
        if not player_name or not position:
            continue

        _get_or_create_player(
            session=session,
            full_name=player_name,
            position=position,
            nfl_team=_optional(_first(row, "nfl_team", "team_abbr")),
            external_id=_optional(_first(row, "external_id", "player_id")),
        )
        stats["players"] += 1


def _seed_draft_results(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    for row in rows:
        league = _league_from_row(session, row, default_league)
        team = _team_from_row(session, row, league)
        position = _normalize_position(_first(row, "position"))
        player = _player_from_row(session, row, position)
        overall_pick = _int(_first(row, "overall_pick", "pick", "draft_pick"), None)
        if team is None or player is None or overall_pick is None:
            continue

        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)
        team_count = _team_count(session, league.id)
        round_number = _int(_first(row, "round", "draft_round"), _round_for_pick(overall_pick, team_count))
        pick_in_round = _int(_first(row, "pick_in_round"), None)

        draft_pick = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league.id,
                DraftPick.season_year == season_year,
                DraftPick.overall_pick == overall_pick,
            )
        ).first()

        if draft_pick is None:
            draft_pick = DraftPick(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                season_year=season_year,
                round=round_number,
                overall_pick=overall_pick,
                pick_in_round=pick_in_round,
                position=position,
            )
            session.add(draft_pick)
        else:
            draft_pick.team_id = team.id
            draft_pick.player_id = player.id
            draft_pick.round = round_number
            draft_pick.pick_in_round = pick_in_round
            draft_pick.position = position

        stats["draft_picks"] += 1


def _seed_final_rosters(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    for row in rows:
        league = _league_from_row(session, row, default_league)
        team = _team_from_row(session, row, league)
        position = _normalize_position(_first(row, "position"))
        player = _player_from_row(session, row, position)
        if team is None or player is None:
            continue

        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)
        roster_status = _first(row, "roster_status", "status", default="Bench")
        entry = session.exec(
            select(FinalRosterEntry).where(
                FinalRosterEntry.league_id == league.id,
                FinalRosterEntry.team_id == team.id,
                FinalRosterEntry.player_id == player.id,
                FinalRosterEntry.season_year == season_year,
            )
        ).first()

        if entry is None:
            entry = FinalRosterEntry(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                season_year=season_year,
                position=position,
                roster_status=roster_status,
            )
            session.add(entry)
        else:
            entry.position = position
            entry.roster_status = roster_status

        stats["final_roster_entries"] += 1


def _seed_adp(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    for row in rows:
        league = _league_from_row(session, row, default_league)
        source = _first(row, "source", "source_name", default="Unknown ADP")
        format_type = _first(row, "format_type", "format", "scoring_format", default=DEFAULT_FORMAT)
        snapshot_date = _date(_first(row, "snapshot_date", "date"), date.today())
        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)
        snapshot_name = _first(row, "snapshot_name", "name", default=f"{source} {snapshot_date}")
        notes = _optional(_first(row, "notes"))

        snapshot = _get_or_create_adp_snapshot(
            session=session,
            league=league,
            season_year=season_year,
            name=snapshot_name,
            source=source,
            format_type=format_type,
            snapshot_date=snapshot_date,
            notes=notes,
        )

        position = _normalize_position(_first(row, "position"))
        player = _player_from_row(session, row, position)
        adp_pick = _float(_first(row, "adp_pick", "adp", "pick"), None)
        if player is None or adp_pick is None:
            continue

        team_count = _team_count(session, league.id)
        adp_round = _float(_first(row, "adp_round", "round"), None)
        if adp_round is None:
            adp_round = float(_round_for_pick(adp_pick, team_count))

        entry = session.exec(
            select(ADPEntry).where(
                ADPEntry.snapshot_id == snapshot.id,
                ADPEntry.player_id == player.id,
            )
        ).first()

        if entry is None:
            entry = ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position=position,
                adp_pick=adp_pick,
                adp_round=adp_round,
                source_note=_optional(_first(row, "source_note", "note")),
            )
            session.add(entry)
        else:
            entry.position = position
            entry.adp_pick = adp_pick
            entry.adp_round = adp_round
            entry.source_note = _optional(_first(row, "source_note", "note"))

        stats["adp_entries"] += 1


def _seed_optimizer_settings(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    int_field_defaults = {
        "max_keepers": 4,
        "max_keepers_per_position": 2,
        "max_qb_keepers": 1,
    }
    float_field_defaults = {
        "minimum_keeper_value": 0,
        "minimum_keeper_score": 0,
        "qb_weight": 1.75,
        "rb_weight": 1.20,
        "wr_weight": 1.00,
        "te_weight": 1.10,
        "k_weight": 0.10,
        "def_weight": 0.10,
        "elite_qb_cutoff": 24,
        "elite_qb_max_negative_edge": 12,
        "talent_anchor": 180,
        "talent_divisor": 15,
        "starter_status_bonus": 3,
        "bench_status_bonus": 1,
        "ir_status_bonus": 0.5,
    }

    for row in rows:
        league = _league_from_row(session, row, default_league)
        name = _first(row, "name", "scenario_name", default="Default")
        settings = session.exec(
            select(OptimizerSettings).where(
                OptimizerSettings.league_id == league.id,
                OptimizerSettings.name == name,
            )
        ).first()

        if settings is None:
            settings = OptimizerSettings(league_id=league.id, name=name)
            session.add(settings)

        for field_name, default in int_field_defaults.items():
            value = _first(row, field_name)
            if value:
                setattr(settings, field_name, _int(value, default))

        for field_name, default in float_field_defaults.items():
            value = _first(row, field_name)
            if value:
                setattr(settings, field_name, _float(value, default))

        max_adp_cap = _float(_first(row, "max_adp_cap"), None)
        qb_max_adp = _float(_first(row, "qb_max_adp"), None)
        settings.max_adp_cap = max_adp_cap
        settings.qb_max_adp = qb_max_adp
        settings.enable_draft_slot_bonus = _bool(
            _first(row, "enable_draft_slot_bonus"),
            settings.enable_draft_slot_bonus,
        )
        settings.enable_qb_scarcity_bonus = _bool(
            _first(row, "enable_qb_scarcity_bonus"),
            settings.enable_qb_scarcity_bonus,
        )
        stats["optimizer_settings"] += 1


def _seed_manual_overrides(
    session: Session,
    rows: list[dict[str, str]],
    default_league: League,
    stats: dict[str, int],
) -> None:
    for row in rows:
        league = _league_from_row(session, row, default_league)
        team = _team_from_row(session, row, league)
        position = _normalize_position(_first(row, "position"))
        player = _player_from_row(session, row, position)
        if team is None or player is None:
            continue

        override = session.exec(
            select(ManualOverride).where(
                ManualOverride.league_id == league.id,
                ManualOverride.team_id == team.id,
                ManualOverride.player_id == player.id,
            )
        ).first()

        if override is None:
            override = ManualOverride(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                override_type=_first(row, "override_type", default="auto"),
                notes=_optional(_first(row, "notes")),
            )
            session.add(override)
        else:
            override.override_type = _first(row, "override_type", default=override.override_type)
            override.notes = _optional(_first(row, "notes"))

        stats["manual_overrides"] += 1


def _get_or_create_league(
    session: Session,
    name: str,
    season_year: int,
    scoring_format: str = DEFAULT_FORMAT,
    draft_type: str = "snake",
    max_keepers: int = 4,
    max_keepers_per_position: int = 2,
    max_qb_keepers: int = 1,
    roster_settings: dict[str, Any] | None = None,
    keeper_rules: dict[str, Any] | None = None,
) -> League:
    league = session.exec(
        select(League).where(League.name == name, League.season_year == season_year)
    ).first()

    if league is None:
        league = League(
            name=name,
            season_year=season_year,
            scoring_format=scoring_format,
            draft_type=draft_type,
            max_keepers=max_keepers,
            max_keepers_per_position=max_keepers_per_position,
            max_qb_keepers=max_qb_keepers,
            roster_settings=roster_settings or {},
            keeper_rules=keeper_rules or {},
        )
        session.add(league)
        session.flush()
    else:
        league.scoring_format = scoring_format or league.scoring_format
        league.draft_type = draft_type or league.draft_type
        league.max_keepers = max_keepers
        league.max_keepers_per_position = max_keepers_per_position
        league.max_qb_keepers = max_qb_keepers
        if roster_settings is not None:
            league.roster_settings = roster_settings
        if keeper_rules is not None:
            league.keeper_rules = keeper_rules

    return league


def _get_or_create_team(
    session: Session,
    league: League,
    name: str,
    owner_name: str | None = None,
    draft_slot: int | None = None,
) -> Team:
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.name == name)
    ).first()

    if team is None:
        team = Team(
            league_id=league.id,
            name=name,
            owner_name=_optional(owner_name),
            draft_slot=draft_slot,
        )
        session.add(team)
        session.flush()
    else:
        if owner_name:
            team.owner_name = owner_name
        if draft_slot is not None:
            team.draft_slot = draft_slot

    return team


def _get_or_create_player(
    session: Session,
    full_name: str,
    position: str,
    nfl_team: str | None = None,
    external_id: str | None = None,
) -> Player:
    player: Player | None = None

    if external_id:
        player = session.exec(select(Player).where(Player.external_id == external_id)).first()

    if player is None:
        players = session.exec(
            select(Player).where(Player.full_name == full_name, Player.position == position)
        ).all()
        player = next((candidate for candidate in players if candidate.nfl_team == nfl_team), None)
        player = player or next((candidate for candidate in players if candidate.nfl_team is None), None)
        player = player or (players[0] if players else None)

    if player is None:
        player = Player(
            external_id=external_id,
            full_name=full_name,
            position=position,
            nfl_team=nfl_team,
        )
        session.add(player)
        session.flush()
    else:
        if external_id and not player.external_id:
            player.external_id = external_id
        if nfl_team and not player.nfl_team:
            player.nfl_team = nfl_team

    return player


def _get_or_create_adp_snapshot(
    session: Session,
    league: League,
    season_year: int,
    name: str,
    source: str,
    format_type: str,
    snapshot_date: date,
    notes: str | None = None,
) -> ADPSnapshot:
    snapshot = session.exec(
        select(ADPSnapshot).where(
            ADPSnapshot.league_id == league.id,
            ADPSnapshot.season_year == season_year,
            ADPSnapshot.source == source,
            ADPSnapshot.format_type == format_type,
            ADPSnapshot.snapshot_date == snapshot_date,
        )
    ).first()

    if snapshot is None:
        snapshot = ADPSnapshot(
            league_id=league.id,
            season_year=season_year,
            name=name,
            source=source,
            format_type=format_type,
            snapshot_date=snapshot_date,
            notes=notes,
        )
        session.add(snapshot)
        session.flush()
    else:
        snapshot.name = name
        snapshot.notes = notes

    return snapshot


def _league_from_row(session: Session, row: dict[str, str], default_league: League) -> League:
    league_name = _first(row, "league", "league_name")
    if not league_name:
        return default_league

    season_year = _int(_first(row, "season_year", "season", "year"), default_league.season_year)
    return _get_or_create_league(
        session=session,
        name=league_name,
        season_year=season_year,
        scoring_format=default_league.scoring_format,
        draft_type=default_league.draft_type,
        max_keepers=default_league.max_keepers,
        max_keepers_per_position=default_league.max_keepers_per_position,
        max_qb_keepers=default_league.max_qb_keepers,
        roster_settings=default_league.roster_settings,
        keeper_rules=default_league.keeper_rules,
    )


def _team_from_row(session: Session, row: dict[str, str], league: League) -> Team | None:
    team_name = _first(row, "team", "team_name", "name")
    if not team_name:
        return None

    return _get_or_create_team(
        session=session,
        league=league,
        name=team_name,
        owner_name=_first(row, "owner_name", "owner"),
        draft_slot=_int(_first(row, "draft_slot", "slot"), None),
    )


def _player_from_row(session: Session, row: dict[str, str], position: str) -> Player | None:
    player_name = _first(row, "player", "full_name", "player_name")
    if not player_name or not position:
        return None

    return _get_or_create_player(
        session=session,
        full_name=player_name,
        position=position,
        nfl_team=_optional(_first(row, "nfl_team", "team_abbr")),
        external_id=_optional(_first(row, "external_id", "player_id")),
    )


def _team_count(session: Session, league_id: Any) -> int:
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    return len(teams) or 12


def _infer_default_season(rows_by_file: dict[str, list[dict[str, str]]]) -> int:
    for rows in rows_by_file.values():
        for row in rows:
            season_year = _int(_first(row, "season_year", "season", "year"), None)
            if season_year is not None:
                return season_year

            snapshot_date = _first(row, "snapshot_date", "date")
            if snapshot_date:
                return _date(snapshot_date, date.today()).year

    return date.today().year


def _first(row: dict[str, str], *names: str, default: str = "") -> str:
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return str(value).strip()
    return default


def _optional(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = str(value).strip()
    return stripped or None


def _normalize_position(position: str) -> str:
    return position.strip().upper()


def _int(value: str | int | float | None, default: int | None) -> int | None:
    if value in (None, ""):
        return default
    return int(float(value))


def _float(value: str | int | float | None, default: float | None) -> float | None:
    if value in (None, ""):
        return default
    return float(value)


def _bool(value: str | bool | None, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value in (None, ""):
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _date(value: str | None, default: date) -> date:
    if not value:
        return default
    return date.fromisoformat(value)


def _json_object(value: str | None, default: dict[str, Any]) -> dict[str, Any]:
    if not value:
        return default

    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object")
    return parsed


def _round_for_pick(pick: float | int, team_count: int) -> int:
    return max(1, math.ceil(float(pick) / max(team_count, 1)))


if __name__ == "__main__":
    print(json.dumps(seed_database(), indent=2, sort_keys=True))
