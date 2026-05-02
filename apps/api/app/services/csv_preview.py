from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from io import StringIO
from typing import Any, Literal
import uuid

from sqlmodel import Session, select

from app.models import League, Team


Severity = Literal["error", "warning"]

VALID_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DEF", "DST"}


@dataclass(frozen=True)
class CSVPreviewIssue:
    row_number: int | None
    field: str | None
    message: str
    severity: Severity = "error"

    def to_row(self) -> dict[str, Any]:
        return {
            "row_number": self.row_number,
            "field": self.field,
            "message": self.message,
            "severity": self.severity,
        }


@dataclass(frozen=True)
class CSVPreviewResult:
    kind: str
    valid: bool
    total_rows: int
    valid_rows: int
    rows: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    warnings: list[dict[str, Any]]

    def to_payload(self) -> dict[str, Any]:
        columns = list(self.rows[0].keys()) if self.rows else []
        return {
            "kind": self.kind,
            "valid": self.valid,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "columns": columns,
            "rows": self.rows,
            "errors": self.errors,
            "warnings": self.warnings,
        }


class CSVPreviewError(ValueError):
    """Raised when a preview cannot be created for the requested league."""


def preview_draft_results_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> CSVPreviewResult:
    league = _require_league(session, league_id)
    parsed = _parse_csv(csv_text)
    team_names = _team_names(session, league.id)
    issues = _header_issues(parsed.fieldnames, {"team": ("team",), "player": ("player",), "position": ("position",), "overall_pick": ("overall_pick", "pick", "draft_pick")})
    rows: list[dict[str, Any]] = []
    seen_picks: dict[int, int] = {}
    seen_players: dict[tuple[str, str], int] = {}

    for row_number, raw in parsed.rows:
        row_issues: list[CSVPreviewIssue] = []
        team_name = _first(raw, "team")
        player_name = _first(raw, "player")
        position = _position(_first(raw, "position"))
        overall_pick, pick_issue = _positive_int(raw, row_number, "overall_pick", "overall_pick", "pick", "draft_pick")
        round_number, round_issue = _optional_positive_int(raw, row_number, "round", "round", "draft_round")
        pick_in_round, pick_in_round_issue = _optional_positive_int(
            raw,
            row_number,
            "pick_in_round",
            "pick_in_round",
        )

        row_issues.extend(
            _required_issues(raw, row_number, {"team": ("team",), "player": ("player",), "position": ("position",)})
        )
        if pick_issue:
            row_issues.append(pick_issue)
        if round_issue:
            row_issues.append(round_issue)
        if pick_in_round_issue:
            row_issues.append(pick_in_round_issue)
        row_issues.extend(_position_issues(position, row_number))
        row_issues.extend(_missing_team_issues(team_name, team_names, row_number))

        if overall_pick is not None:
            previous = seen_picks.get(overall_pick)
            if previous is not None:
                row_issues.append(
                    CSVPreviewIssue(
                        row_number,
                        "overall_pick",
                        f"Duplicate overall pick also appears on row {previous}",
                    )
                )
            else:
                seen_picks[overall_pick] = row_number

        player_key = _player_key(player_name, position)
        if player_key:
            previous = seen_players.get(player_key)
            if previous is not None:
                row_issues.append(
                    CSVPreviewIssue(
                        row_number,
                        "player",
                        f"Duplicate player/position also appears on row {previous}",
                    )
                )
            else:
                seen_players[player_key] = row_number

        issues.extend(row_issues)
        rows.append(
            {
                "row_number": row_number,
                "team": team_name,
                "player": player_name,
                "position": position,
                "round": round_number,
                "overall_pick": overall_pick,
                "pick_in_round": pick_in_round,
                "status": _row_status(row_issues),
            }
        )

    return _result("draft-results", rows, issues)


def preview_final_rosters_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> CSVPreviewResult:
    league = _require_league(session, league_id)
    parsed = _parse_csv(csv_text)
    team_names = _team_names(session, league.id)
    issues = _header_issues(parsed.fieldnames, {"team": ("team",), "player": ("player",), "position": ("position",)})
    rows: list[dict[str, Any]] = []
    seen_roster_players: dict[tuple[str, str], int] = {}

    for row_number, raw in parsed.rows:
        row_issues: list[CSVPreviewIssue] = []
        team_name = _first(raw, "team")
        player_name = _first(raw, "player")
        position = _position(_first(raw, "position"))
        roster_status = _first(raw, "roster_status", "status") or "Bench"

        row_issues.extend(
            _required_issues(raw, row_number, {"team": ("team",), "player": ("player",), "position": ("position",)})
        )
        row_issues.extend(_position_issues(position, row_number))
        row_issues.extend(_missing_team_issues(team_name, team_names, row_number))

        roster_key = (team_name.casefold(), player_name.casefold())
        if team_name and player_name:
            previous = seen_roster_players.get(roster_key)
            if previous is not None:
                row_issues.append(
                    CSVPreviewIssue(
                        row_number,
                        "player",
                        f"Duplicate team/player roster row also appears on row {previous}",
                    )
                )
            else:
                seen_roster_players[roster_key] = row_number

        issues.extend(row_issues)
        rows.append(
            {
                "row_number": row_number,
                "team": team_name,
                "player": player_name,
                "position": position,
                "roster_status": roster_status,
                "status": _row_status(row_issues),
            }
        )

    return _result("final-rosters", rows, issues)


def preview_adp_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> CSVPreviewResult:
    _require_league(session, league_id)
    parsed = _parse_csv(csv_text)
    issues = _header_issues(parsed.fieldnames, {"player": ("player",), "position": ("position",), "adp_pick": ("adp_pick", "adp", "pick")})
    rows: list[dict[str, Any]] = []
    seen_players: dict[tuple[str, str], int] = {}

    for row_number, raw in parsed.rows:
        row_issues: list[CSVPreviewIssue] = []
        player_name = _first(raw, "player")
        position = _position(_first(raw, "position"))
        adp_pick, adp_issue = _positive_float(raw, row_number, "adp_pick", "adp_pick", "adp", "pick")
        adp_round, round_issue = _optional_positive_float(raw, row_number, "adp_round", "adp_round", "round")
        source = _first(raw, "source", "source_name") or "Unknown ADP"
        snapshot_date = _first(raw, "snapshot_date", "date") or date.today().isoformat()

        row_issues.extend(
            _required_issues(raw, row_number, {"player": ("player",), "position": ("position",), "adp_pick": ("adp_pick", "adp", "pick")})
        )
        if adp_issue:
            row_issues.append(adp_issue)
        if round_issue:
            row_issues.append(round_issue)
        row_issues.extend(_position_issues(position, row_number))
        if snapshot_date and not _is_iso_date(snapshot_date):
            row_issues.append(CSVPreviewIssue(row_number, "snapshot_date", "Snapshot date must use YYYY-MM-DD"))

        player_key = _player_key(player_name, position)
        if player_key:
            previous = seen_players.get(player_key)
            if previous is not None:
                row_issues.append(
                    CSVPreviewIssue(
                        row_number,
                        "player",
                        f"Duplicate player/position also appears on row {previous}",
                    )
                )
            else:
                seen_players[player_key] = row_number

        issues.extend(row_issues)
        rows.append(
            {
                "row_number": row_number,
                "player": player_name,
                "position": position,
                "adp_pick": adp_pick,
                "adp_round": adp_round,
                "source": source,
                "snapshot_date": snapshot_date,
                "status": _row_status(row_issues),
            }
        )

    return _result("adp", rows, issues)


@dataclass(frozen=True)
class ParsedCSV:
    fieldnames: set[str]
    rows: list[tuple[int, dict[str, str]]]


def _parse_csv(csv_text: str) -> ParsedCSV:
    reader = csv.DictReader(StringIO(csv_text.strip()))
    if not reader.fieldnames:
        return ParsedCSV(fieldnames=set(), rows=[])

    rows = [
        (
            index,
            {
                str(key).strip().lower(): str(value or "").strip()
                for key, value in row.items()
                if key is not None
            },
        )
        for index, row in enumerate(reader, start=2)
    ]
    return ParsedCSV(
        fieldnames={str(field_name).strip().lower() for field_name in reader.fieldnames},
        rows=rows,
    )


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise CSVPreviewError(f"League {league_id} was not found")
    return league


def _team_names(session: Session, league_id: uuid.UUID) -> set[str]:
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    return {team.name.casefold() for team in teams}


def _header_issues(
    fieldnames: set[str],
    required_groups: dict[str, tuple[str, ...]],
) -> list[CSVPreviewIssue]:
    if not fieldnames:
        return [CSVPreviewIssue(None, None, "CSV header row is required")]

    issues: list[CSVPreviewIssue] = []
    for field, aliases in required_groups.items():
        if not any(alias in fieldnames for alias in aliases):
            issues.append(
                CSVPreviewIssue(
                    None,
                    field,
                    f"Missing required CSV column: {'/'.join(aliases)}",
                )
            )
    return issues


def _required_issues(
    row: dict[str, str],
    row_number: int,
    required_groups: dict[str, tuple[str, ...]],
) -> list[CSVPreviewIssue]:
    issues: list[CSVPreviewIssue] = []
    for field, aliases in required_groups.items():
        if not _first(row, *aliases):
            issues.append(
                CSVPreviewIssue(
                    row_number,
                    field,
                    f"Missing required value: {'/'.join(aliases)}",
                )
            )
    return issues


def _position_issues(position: str, row_number: int) -> list[CSVPreviewIssue]:
    if not position or position in VALID_POSITIONS:
        return []
    return [CSVPreviewIssue(row_number, "position", f"Unsupported position: {position}")]


def _missing_team_issues(
    team_name: str,
    team_names: set[str],
    row_number: int,
) -> list[CSVPreviewIssue]:
    if not team_name or team_name.casefold() in team_names:
        return []
    return [
        CSVPreviewIssue(
            row_number,
            "team",
            "Team is not in this league yet; import will create it if you continue",
            "warning",
        )
    ]


def _positive_int(
    row: dict[str, str],
    row_number: int,
    field: str,
    *aliases: str,
) -> tuple[int | None, CSVPreviewIssue | None]:
    value = _first(row, *aliases)
    if not value:
        return None, None
    try:
        parsed = int(float(value))
    except ValueError:
        return None, CSVPreviewIssue(row_number, field, f"Invalid integer value: {value}")
    if parsed <= 0:
        return None, CSVPreviewIssue(row_number, field, "Value must be greater than zero")
    return parsed, None


def _optional_positive_int(
    row: dict[str, str],
    row_number: int,
    field: str,
    *aliases: str,
) -> tuple[int | None, CSVPreviewIssue | None]:
    return _positive_int(row, row_number, field, *aliases) if _first(row, *aliases) else (None, None)


def _positive_float(
    row: dict[str, str],
    row_number: int,
    field: str,
    *aliases: str,
) -> tuple[float | None, CSVPreviewIssue | None]:
    value = _first(row, *aliases)
    if not value:
        return None, None
    try:
        parsed = float(value)
    except ValueError:
        return None, CSVPreviewIssue(row_number, field, f"Invalid numeric value: {value}")
    if parsed <= 0:
        return None, CSVPreviewIssue(row_number, field, "Value must be greater than zero")
    return parsed, None


def _optional_positive_float(
    row: dict[str, str],
    row_number: int,
    field: str,
    *aliases: str,
) -> tuple[float | None, CSVPreviewIssue | None]:
    return _positive_float(row, row_number, field, *aliases) if _first(row, *aliases) else (None, None)


def _first(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value:
            return value
    return ""


def _position(position: str) -> str:
    return position.strip().upper()


def _player_key(player_name: str, position: str) -> tuple[str, str] | None:
    if not player_name or not position:
        return None
    return player_name.casefold(), position


def _is_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _row_status(issues: list[CSVPreviewIssue]) -> str:
    if any(issue.severity == "error" for issue in issues):
        return "Error"
    if issues:
        return "Warning"
    return "Ready"


def _result(
    kind: str,
    rows: list[dict[str, Any]],
    issues: list[CSVPreviewIssue],
) -> CSVPreviewResult:
    errors = [issue.to_row() for issue in issues if issue.severity == "error"]
    warnings = [issue.to_row() for issue in issues if issue.severity == "warning"]
    row_error_numbers = {issue.row_number for issue in issues if issue.severity == "error"}
    valid_rows = sum(1 for row in rows if row["row_number"] not in row_error_numbers)
    return CSVPreviewResult(
        kind=kind,
        valid=not errors and bool(rows),
        total_rows=len(rows),
        valid_rows=valid_rows,
        rows=rows,
        errors=errors,
        warnings=warnings,
    )
