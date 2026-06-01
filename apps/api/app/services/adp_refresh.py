from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from io import StringIO
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import League, Team
from app.services.ai_adp import AIADPError, board_to_csv, build_ai_adp_board
from app.services.csv_imports import CSVImportError, ImportResult, import_adp_csv


class ADPRefreshError(Exception):
    """Raised when the configured ADP refresh request cannot be completed."""


@dataclass
class ADPRefreshResult:
    provider: str
    source_url: str
    import_result: ImportResult


def refresh_adp_from_api(
    session: Session,
    league_id: uuid.UUID,
    settings: Settings,
) -> ADPRefreshResult:
    league = session.get(League, league_id)
    if league is None:
        raise ADPRefreshError(f"League {league_id} was not found")

    provider = _resolve_provider(settings)
    if provider in {"composite", "multi"}:
        return _refresh_composite(session, league, settings)
    if provider in {"fantasyfootballcalculator", "ffc"}:
        return _refresh_from_fantasy_football_calculator(session, league, settings)
    if provider == "fantasynerds":
        return _refresh_from_fantasy_nerds(session, league, settings)
    if provider in {"ai_synthesized", "ai", "openai"}:
        return _refresh_from_ai_synthesized(session, league, settings)
    if provider == "csv_url":
        return _refresh_from_csv_url(session, league_id, settings)
    raise ADPRefreshError(f"Unsupported ADP provider: {provider}")


def _refresh_composite(
    session: Session,
    league: League,
    settings: Settings,
) -> ADPRefreshResult:
    from app.services.composite_adp import CompositeADPError, build_composite_adp_template_rows
    try:
        composite = build_composite_adp_template_rows(session, league, settings, yahoo_access_token=None)
        import_rows = [row for row in composite.rows if str(row.get("adp_pick", "")).strip()]
        if not import_rows:
            raise ADPRefreshError("Composite ADP build returned no importable rows")
        result = import_adp_csv(session, league.id, _rows_to_csv(import_rows))
    except (CompositeADPError, CSVImportError) as exc:
        raise ADPRefreshError(str(exc)) from exc
    return ADPRefreshResult(
        provider="composite",
        source_url="composite",
        import_result=result,
    )


def _rows_to_csv(rows: list[dict[str, object]]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()), extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _refresh_from_fantasy_football_calculator(
    session: Session,
    league: League,
    settings: Settings,
) -> ADPRefreshResult:
    team_count = _team_count(session, league)
    scoring = _fantasy_football_calculator_scoring(league.scoring_format)
    request_url = (
        f"{settings.fantasy_football_calculator_adp_url}/{scoring}"
        f"?{urllib.parse.urlencode({'teams': team_count, 'year': league.season_year})}"
    )
    payload = _read_remote_payload(request_url, settings, accept_header="application/json, */*;q=0.5")

    try:
        response_json = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ADPRefreshError("Fantasy Football Calculator returned invalid JSON") from exc

    players = response_json.get("players")
    if not isinstance(players, list) or not players:
        raise ADPRefreshError("Fantasy Football Calculator returned no ADP rows")

    csv_lines = ["player,position,adp_pick,source,snapshot_date,format"]
    for player in players:
        if not isinstance(player, dict):
            continue
        name = _player_name(player)
        position = str(player.get("position", "")).strip().upper()
        adp_pick = _player_adp(player)
        if not name or not position or adp_pick is None:
            continue
        csv_lines.append(
            f"{_csv_escape(name)},{_csv_escape(position)},{adp_pick},Fantasy Football Calculator,{date.today().isoformat()},{_csv_escape(league.scoring_format)}"
        )

    if len(csv_lines) == 1:
        raise ADPRefreshError("Fantasy Football Calculator returned no usable ADP rows")

    try:
        import_result = import_adp_csv(session, league.id, "\n".join(csv_lines))
    except CSVImportError as exc:
        raise ADPRefreshError(str(exc)) from exc

    return ADPRefreshResult(
        provider="fantasyfootballcalculator",
        source_url=request_url,
        import_result=import_result,
    )


def _refresh_from_fantasy_nerds(
    session: Session,
    league: League,
    settings: Settings,
) -> ADPRefreshResult:
    if not settings.fantasy_nerds_api_key:
        raise ADPRefreshError("Fantasy Nerds API key is not configured")

    team_count = _team_count(session, league)
    request_url = (
        f"{settings.fantasy_nerds_adp_url}"
        f"?{urllib.parse.urlencode({'apikey': settings.fantasy_nerds_api_key, 'teams': team_count, 'format': _fantasy_nerds_format(league.scoring_format)})}"
    )
    payload = _read_remote_payload(request_url, settings, accept_header="application/json, */*;q=0.5")

    try:
        response_json = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ADPRefreshError("Fantasy Nerds returned invalid JSON") from exc

    players = _extract_players(response_json)
    if not players:
        raise ADPRefreshError("Fantasy Nerds returned no ADP rows")

    snapshot_date = _fantasy_nerds_snapshot_date(players)
    csv_lines = ["player,position,adp_pick,source,snapshot_date,format"]
    for player in players:
        name = _player_name(player)
        position = str(player.get("position", "")).strip().upper()
        adp_pick = _player_adp(player)
        if not name or not position or adp_pick is None:
            continue
        csv_lines.append(
            f"{_csv_escape(name)},{_csv_escape(position)},{adp_pick},Fantasy Nerds,{snapshot_date.isoformat()},{_csv_escape(league.scoring_format)}"
        )

    if len(csv_lines) == 1:
        raise ADPRefreshError("Fantasy Nerds returned no usable ADP rows")

    csv_text = "\n".join(csv_lines)
    try:
        import_result = import_adp_csv(session, league.id, csv_text)
    except CSVImportError as exc:
        raise ADPRefreshError(str(exc)) from exc

    return ADPRefreshResult(
        provider="fantasynerds",
        source_url=request_url,
        import_result=import_result,
    )


def _refresh_from_csv_url(
    session: Session,
    league_id: uuid.UUID,
    settings: Settings,
) -> ADPRefreshResult:
    if not settings.adp_refresh_url:
        raise ADPRefreshError("ADP refresh URL is not configured")

    payload = _read_remote_payload(
        settings.adp_refresh_url,
        settings,
        accept_header="text/csv, text/plain;q=0.9, */*;q=0.5",
    )
    try:
        csv_text = payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ADPRefreshError("ADP refresh response is not valid UTF-8 CSV data") from exc

    if not csv_text.strip():
        raise ADPRefreshError("ADP refresh response was empty")

    try:
        import_result = import_adp_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise ADPRefreshError(str(exc)) from exc

    return ADPRefreshResult(
        provider="csv_url",
        source_url=settings.adp_refresh_url,
        import_result=import_result,
    )


def _refresh_from_ai_synthesized(
    session: Session,
    league: League,
    settings: Settings,
) -> ADPRefreshResult:
    try:
        board = build_ai_adp_board(session, league, settings)
        import_result = import_adp_csv(session, league.id, board_to_csv(board, league))
    except (AIADPError, CSVImportError) as exc:
        raise ADPRefreshError(str(exc)) from exc
    return ADPRefreshResult(
        provider="ai_synthesized",
        source_url=board.source_url,
        import_result=import_result,
    )


def _read_remote_payload(
    request_url: str,
    settings: Settings,
    *,
    accept_header: str,
) -> bytes:
    request = urllib.request.Request(
        request_url,
        headers=_request_headers(settings, accept_header=accept_header),
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.adp_refresh_timeout_seconds) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        raise ADPRefreshError(f"ADP refresh request failed with status {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise ADPRefreshError("ADP refresh request could not reach the configured source") from exc


def _request_headers(settings: Settings, *, accept_header: str) -> dict[str, str]:
    headers = {
        "Accept": accept_header,
        "User-Agent": "keeper-optimizer-adp-refresh/0.1",
    }
    if settings.adp_refresh_token:
        headers["Authorization"] = f"Bearer {settings.adp_refresh_token}"
    return headers


def _resolve_provider(settings: Settings) -> str:
    if settings.adp_provider:
        return settings.adp_provider.strip().lower()
    if settings.adp_refresh_url:
        return "csv_url"
    return "composite"


def _fantasy_football_calculator_scoring(scoring_format: str) -> str:
    normalized = scoring_format.strip().lower()
    return {
        "superflex": "2qb",
        "2qb": "2qb",
        "ppr": "ppr",
        "half-ppr": "half-ppr",
        "half_ppr": "half-ppr",
        "half": "half-ppr",
        "standard": "standard",
        "std": "standard",
    }.get(normalized, "ppr")


def _fantasy_nerds_format(scoring_format: str) -> str:
    normalized = scoring_format.strip().lower()
    return {
        "superflex": "superflex",
        "2qb": "superflex",
        "half-ppr": "half",
        "half_ppr": "half",
        "half": "half",
        "ppr": "ppr",
        "standard": "std",
        "std": "std",
    }.get(normalized, "superflex")


def _extract_players(payload: object) -> list[dict[str, object]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("players", "PlayerRankings", "player_rankings", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
    return []


def _fantasy_nerds_snapshot_date(players: list[dict[str, object]]) -> date:
    for player in players:
        last_update = player.get("last_update")
        if isinstance(last_update, str) and last_update:
            try:
                return date.fromisoformat(last_update[:10])
            except ValueError:
                continue
    return date.today()


def _player_name(player: dict[str, object]) -> str:
    for key in ("name", "player_name", "display_name"):
        value = player.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _player_adp(player: dict[str, object]) -> float | None:
    for key in ("adp", "adp_pick", "overall_rank", "rank"):
        value = player.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError:
                continue
    return None


def _csv_escape(value: str) -> str:
    if any(char in value for char in [",", "\"", "\n"]):
        return f"\"{value.replace('\"', '\"\"')}\""
    return value


def _team_count(session: Session, league: League) -> int:
    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    return len(teams) or 12
