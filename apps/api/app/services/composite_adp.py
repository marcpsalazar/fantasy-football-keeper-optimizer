from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from html import unescape
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import ADPEntry, ADPSnapshot, DraftPick, FinalRosterEntry, League, Player, Team


class CompositeADPError(Exception):
    """Raised when a composite ADP export cannot be built."""


PUBLIC_DRAFTSHARKS_ROW_LIMIT = 26


@dataclass(frozen=True)
class ProviderRow:
    player: str
    position: str
    adp_pick: float
    nfl_team: str | None = None


@dataclass(frozen=True)
class ProviderFetchResult:
    rows: dict[tuple[str, str], ProviderRow]
    error: str | None = None


@dataclass(frozen=True)
class CompositeCandidate:
    player: str
    position: str
    nfl_team: str | None
    composite_adp: float | None
    composite_method: str
    draftsharks_adp: float | None
    ffc_2qb_adp: float | None
    ffc_ppr_adp: float | None
    existing_adp: float | None
    review_flag: str


def build_composite_adp_template_rows(
    session: Session,
    league: League,
    settings: Settings,
) -> list[dict[str, str]]:
    team_count = _team_count(session, league)
    _, current_entries = _load_current_snapshot(session, league.id)
    current_by_key = {
        _player_key(player.full_name, player.position): (player, entry)
        for player, entry in current_entries
    }

    source_draftsharks = _fetch_draftsharks_superflex_rows(settings)
    sleeper_players = _fetch_sleeper_players(settings)

    if not source_draftsharks.rows:
        details = "; ".join(
            detail for detail in [source_draftsharks.error] if detail
        ) or "DraftSharks returned no usable superflex rows"
        raise CompositeADPError(
            "Composite ADP build failed because the external ADP sources were unavailable. "
            f"Details: {details}"
        )

    league_players = _load_league_players(session, league.id)
    league_keys = {_player_key(player.full_name, player.position) for player in league_players}

    provider_keys = set(source_draftsharks.rows)
    focus_limit = max(300, team_count * 25)
    early_board_cutoff = max(120, team_count * 10)

    candidate_cache: dict[tuple[str, str], CompositeCandidate] = {}

    def resolve_candidate(key: tuple[str, str]) -> CompositeCandidate:
        if key not in candidate_cache:
            candidate_cache[key] = _build_candidate(
                key,
                source_draftsharks=source_draftsharks.rows,
                sleeper_players=sleeper_players,
                current_by_key=current_by_key,
            )
        return candidate_cache[key]

    composite_candidates = [resolve_candidate(key) for key in provider_keys]
    composite_candidates.sort(
        key=lambda candidate: (
            candidate.composite_adp if candidate.composite_adp is not None else 9999,
            candidate.position,
            candidate.player,
        )
    )

    focused_keys = {candidate_key(candidate) for candidate in composite_candidates[:focus_limit]}
    focused_keys.update(
        candidate_key(candidate)
        for candidate in composite_candidates
        if candidate.composite_adp is not None and candidate.composite_adp <= early_board_cutoff
    )
    focused_keys.update(league_keys)
    focused_keys.update(current_by_key.keys())

    sorted_keys = sorted(
        focused_keys,
        key=lambda key: (
            _export_adp_pick(resolve_candidate(key)) if _export_adp_pick(resolve_candidate(key)) is not None else 9999,
            key[1],
            key[0],
        ),
    )
    rows = [
        _candidate_row(
            resolve_candidate(key),
            league=league,
            team_count=team_count,
        )
        for key in sorted_keys
    ]

    if not rows:
        raise CompositeADPError("No league players or ADP source rows were available to build the composite CSV")
    return rows


def candidate_key(candidate: CompositeCandidate) -> tuple[str, str]:
    return _player_key(candidate.player, candidate.position)


def _load_current_snapshot(
    session: Session,
    league_id: uuid.UUID,
) -> tuple[ADPSnapshot | None, list[tuple[Player, ADPEntry]]]:
    snapshot = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league_id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()
    if snapshot is None:
        return None, []

    entries = session.exec(select(ADPEntry).where(ADPEntry.snapshot_id == snapshot.id)).all()
    if not entries:
        return snapshot, []

    players = {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_({entry.player_id for entry in entries}))).all()
    }
    return snapshot, [(players[entry.player_id], entry) for entry in entries if entry.player_id in players]


def _load_league_players(session: Session, league_id: uuid.UUID) -> list[Player]:
    player_ids: set[uuid.UUID] = set(
        session.exec(select(DraftPick.player_id).where(DraftPick.league_id == league_id)).all()
    )
    player_ids.update(
        session.exec(select(FinalRosterEntry.player_id).where(FinalRosterEntry.league_id == league_id)).all()
    )
    if not player_ids:
        return []
    return session.exec(select(Player).where(Player.id.in_(player_ids))).all()


def _build_candidate(
    key: tuple[str, str],
    *,
    source_draftsharks: dict[tuple[str, str], ProviderRow],
    sleeper_players: dict[tuple[str, str], dict[str, str]],
    current_by_key: dict[tuple[str, str], tuple[Player, ADPEntry]],
) -> CompositeCandidate:
    draftsharks_row = source_draftsharks.get(key)
    current = current_by_key.get(key)
    sleeper = sleeper_players.get(key)

    player_name = (
        (current[0].full_name if current else None)
        or (draftsharks_row.player if draftsharks_row else None)
        or (sleeper.get("full_name") if sleeper else "")
    )
    position = (
        (current[0].position if current else None)
        or (draftsharks_row.position if draftsharks_row else None)
        or (sleeper.get("position") if sleeper else "")
    )
    nfl_team = (
        (current[0].nfl_team if current and current[0].nfl_team else None)
        or (draftsharks_row.nfl_team if draftsharks_row and draftsharks_row.nfl_team else None)
        or (sleeper.get("team") if sleeper else None)
    )
    existing_adp = current[1].adp_pick if current else None
    composite_adp, composite_method = _compose_adp(
        position=position or key[1],
        draftsharks_adp=draftsharks_row.adp_pick if draftsharks_row else None,
        existing_adp=existing_adp,
    )
    review_flag = _review_flag(
        position=position or key[1],
        draftsharks_adp=draftsharks_row.adp_pick if draftsharks_row else None,
        existing_adp=existing_adp,
    )

    return CompositeCandidate(
        player=player_name or key[0],
        position=position or key[1],
        nfl_team=nfl_team,
        composite_adp=composite_adp,
        composite_method=composite_method,
        draftsharks_adp=draftsharks_row.adp_pick if draftsharks_row else None,
        ffc_2qb_adp=None,
        ffc_ppr_adp=None,
        existing_adp=existing_adp,
        review_flag=review_flag,
    )


def _compose_adp(
    *,
    position: str,
    draftsharks_adp: float | None,
    existing_adp: float | None,
) -> tuple[float | None, str]:
    if draftsharks_adp is not None:
        return draftsharks_adp, "draftsharks_superflex_adp"
    if existing_adp is not None:
        return None, "missing_from_draftsharks"
    return None, "missing"


def _review_flag(
    *,
    position: str,
    draftsharks_adp: float | None,
    existing_adp: float | None,
) -> str:
    if draftsharks_adp is None and existing_adp is None:
        return "missing_all_sources"
    if draftsharks_adp is None:
        return "missing_from_draftsharks"
    return ""


def _candidate_row(
    candidate: CompositeCandidate,
    *,
    league: League,
    team_count: int,
) -> dict[str, str]:
    exported_adp_pick = _export_adp_pick(candidate)
    composite_round = (
        f"{((exported_adp_pick - 1) // team_count) + 1:g}"
        if exported_adp_pick is not None and team_count > 0
        else ""
    )
    return {
        "player": candidate.player,
        "position": candidate.position,
        "nfl_team": candidate.nfl_team or "",
        "adp_pick": _fmt(exported_adp_pick),
        "adp_round": composite_round,
        "source": f"Composite {league.scoring_format.title()} ADP - {league.name}",
        "snapshot_name": f"{league.name} Composite ADP",
        "snapshot_date": date.today().isoformat(),
        "format": league.scoring_format,
        "source_note": _source_note(candidate),
        "draftsharks_superflex_adp": _fmt(candidate.draftsharks_adp),
        "ffc_2qb_adp": _fmt(candidate.ffc_2qb_adp),
        "ffc_ppr_adp": _fmt(candidate.ffc_ppr_adp),
        "existing_adp": _fmt(candidate.existing_adp),
        "composite_method": candidate.composite_method,
        "review_flag": candidate.review_flag,
    }


def _source_note(candidate: CompositeCandidate) -> str:
    notes: list[str] = []
    if candidate.draftsharks_adp is not None:
        notes.append(f"DraftSharks Superflex ADP {candidate.draftsharks_adp:g}")
    if candidate.existing_adp is not None:
        notes.append(f"existing {candidate.existing_adp:g}")
    if candidate.review_flag:
        notes.append(f"review:{candidate.review_flag}")
    return "; ".join(notes)


def _export_adp_pick(candidate: CompositeCandidate) -> float | None:
    return candidate.composite_adp


def _fetch_draftsharks_superflex_rows(settings: Settings) -> ProviderFetchResult:
    request_url = settings.draftsharks_superflex_adp_url
    browser_result = _fetch_draftsharks_browser_rows(settings)
    if browser_result.rows:
        return browser_result

    try:
        payload = _read_remote_payload(
            request_url,
            settings,
            accept_header="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        html_text = payload.decode("utf-8")
        rows = _parse_draftsharks_superflex_rows(html_text)
    except urllib.error.HTTPError as exc:
        return ProviderFetchResult(rows={}, error=f"DraftSharks HTTP {exc.code}")
    except (urllib.error.URLError, OSError):
        return ProviderFetchResult(rows={}, error="DraftSharks unreachable")
    except UnicodeDecodeError:
        return ProviderFetchResult(rows={}, error="DraftSharks unreadable payload")

    if _is_gated_draftsharks_response(html_text, rows):
        return ProviderFetchResult(
            rows={},
            error=(
                "DraftSharks public page is truncated and only exposes the first "
                f"{len(rows)} players without a paid session"
                + (f"; browser scrape failed: {browser_result.error}" if browser_result.error else "")
            ),
        )
    if not rows:
        return ProviderFetchResult(
            rows={},
            error=(
                "DraftSharks returned no usable superflex rows"
                + (f"; browser scrape failed: {browser_result.error}" if browser_result.error else "")
            ),
        )
    return ProviderFetchResult(rows=rows)


def _fetch_draftsharks_browser_rows(settings: Settings) -> ProviderFetchResult:
    script_path = _repo_root() / "scripts" / "draftsharks_scrape.mjs"
    if not script_path.exists():
        return ProviderFetchResult(rows={}, error="DraftSharks browser scraper script is missing")

    try:
        completed = subprocess.run(
            ["node", str(script_path), settings.draftsharks_superflex_adp_url],
            cwd=_repo_root(),
            capture_output=True,
            check=False,
            text=True,
            timeout=max(settings.adp_refresh_timeout_seconds, 30),
        )
    except FileNotFoundError:
        return ProviderFetchResult(rows={}, error="Node.js is unavailable for DraftSharks browser scrape")
    except subprocess.TimeoutExpired:
        return ProviderFetchResult(rows={}, error="DraftSharks browser scrape timed out")
    except OSError as exc:
        return ProviderFetchResult(rows={}, error=f"DraftSharks browser scrape failed: {exc}")

    payload_text = completed.stdout.strip().splitlines()[-1] if completed.stdout.strip() else ""
    try:
        payload = json.loads(payload_text) if payload_text else {}
    except json.JSONDecodeError:
        stderr = completed.stderr.strip()
        detail = stderr.splitlines()[-1] if stderr else "invalid scraper JSON"
        return ProviderFetchResult(rows={}, error=f"DraftSharks browser scrape failed: {detail}")

    rows = _parse_draftsharks_browser_payload(payload)
    if completed.returncode != 0:
        error = _string(payload.get("error")) if isinstance(payload, dict) else ""
        return ProviderFetchResult(
            rows={},
            error=error or f"DraftSharks browser scrape exited with {completed.returncode}",
        )
    if len(rows) <= PUBLIC_DRAFTSHARKS_ROW_LIMIT:
        return ProviderFetchResult(
            rows={},
            error=(
                "DraftSharks browser scrape was truncated and only returned "
                f"{len(rows)} players"
            ),
        )
    return ProviderFetchResult(rows=rows)


def _parse_draftsharks_browser_payload(payload: object) -> dict[tuple[str, str], ProviderRow]:
    if not isinstance(payload, dict):
        return {}
    payload_rows = payload.get("rows")
    if not isinstance(payload_rows, list):
        return {}

    rows: dict[tuple[str, str], ProviderRow] = {}
    for row in payload_rows:
        if not isinstance(row, dict):
            continue
        player = _string(row.get("player"))
        position = _string(row.get("position")).upper()
        nfl_team = _string(row.get("nfl_team")).upper() or None
        adp_pick = _coerce_float(row.get("adp_pick"))
        if not player or not position or adp_pick is None or adp_pick <= 0:
            continue
        position = "DST" if position == "DEF" else position
        rows[_player_key(player, position)] = ProviderRow(
            player=player,
            position=position,
            adp_pick=adp_pick,
            nfl_team=nfl_team,
        )
    return rows


def _parse_draftsharks_superflex_rows(html_text: str) -> dict[tuple[str, str], ProviderRow]:
    rows: dict[tuple[str, str], ProviderRow] = {}
    row_pattern = re.compile(
        r'<tr class="player-row">.*?'
        r'<div class="column-title rank-index">\s*<span>(?P<rank>\d+)</span>.*?'
        r'<a class="hide-on-mobile"[^>]*>\s*(?P<player>[^<]+?)\s*</a>.*?'
        r'<span>(?P<team>[A-Z]{2,4})</span>\s*'
        r'<div class="position-rank [^"]*">(?P<pos>QB|RB|WR|TE|K|DEF)\d+</div>.*?'
        r'<td class="adp centered" data-value="(?P<adp>[^"]+)"',
        re.DOTALL,
    )
    for match in row_pattern.finditer(html_text):
        player = unescape(match.group("player")).strip()
        position = "DST" if match.group("pos") == "DEF" else match.group("pos")
        nfl_team = match.group("team")
        if not player:
            continue
        rows[_player_key(player, position)] = ProviderRow(
            player=player,
            position=position,
            adp_pick=float(match.group("adp")),
            nfl_team=nfl_team,
        )
    return rows


def _is_gated_draftsharks_response(
    html_text: str,
    rows: dict[tuple[str, str], ProviderRow],
) -> bool:
    if len(rows) > PUBLIC_DRAFTSHARKS_ROW_LIMIT:
        return False

    lowered = html_text.casefold()
    gating_markers = (
        "subscriptionappdata",
        "keeper tools",
        "most_popular",
        "upgrade",
    )
    return any(marker in lowered for marker in gating_markers)


def _fetch_ffc_rows(
    settings: Settings,
    league: League,
    team_count: int,
    scoring: str,
) -> ProviderFetchResult:
    api_request_url = (
        f"{settings.fantasy_football_calculator_adp_url}/{scoring}"
        f"?{urllib.parse.urlencode({'teams': team_count, 'year': league.season_year})}"
    )
    try:
        payload = _read_remote_payload(
            api_request_url,
            settings,
            accept_header="application/json, */*;q=0.5",
        )
        response_text = payload.decode("utf-8")
        response_json = json.loads(response_text)
    except urllib.error.HTTPError as exc:
        return _fetch_ffc_rows_from_html(settings, league, team_count, scoring, f"FFC {scoring} HTTP {exc.code}")
    except (urllib.error.URLError, OSError):
        return _fetch_ffc_rows_from_html(settings, league, team_count, scoring, f"FFC {scoring} unreachable")
    except UnicodeDecodeError:
        return _fetch_ffc_rows_from_html(settings, league, team_count, scoring, f"FFC {scoring} unreadable payload")
    except json.JSONDecodeError:
        if "<html" not in response_text.casefold():
            return _fetch_ffc_rows_from_html(settings, league, team_count, scoring, f"FFC {scoring} invalid JSON")
        html_rows = _parse_ffc_html_rows(response_text)
        if html_rows:
            return ProviderFetchResult(rows=html_rows)
        return _fetch_ffc_rows_from_html(
            settings,
            league,
            team_count,
            scoring,
            f"FFC {scoring} API returned HTML instead of JSON",
        )

    rows = _parse_ffc_json_rows(response_json)
    if rows:
        return ProviderFetchResult(rows=rows)
    return _fetch_ffc_rows_from_html(
        settings,
        league,
        team_count,
        scoring,
        f"FFC {scoring} returned no usable JSON rows",
    )


def _fetch_ffc_rows_from_html(
    settings: Settings,
    league: League,
    team_count: int,
    scoring: str,
    prior_error: str,
) -> ProviderFetchResult:
    page_url = f"https://fantasyfootballcalculator.com/adp/{scoring}/{team_count}-team/all"
    if league.season_year < date.today().year:
        page_url = f"{page_url}/{league.season_year}"

    try:
        payload = _read_remote_payload(
            page_url,
            settings,
            accept_header="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        rows = _parse_ffc_html_rows(payload.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return ProviderFetchResult(rows={}, error=f"{prior_error}; FFC {scoring} page HTTP {exc.code}")
    except (urllib.error.URLError, OSError):
        return ProviderFetchResult(rows={}, error=f"{prior_error}; FFC {scoring} page unreachable")
    except UnicodeDecodeError:
        return ProviderFetchResult(rows={}, error=f"{prior_error}; FFC {scoring} page unreadable")

    if not rows:
        return ProviderFetchResult(rows={}, error=f"{prior_error}; FFC {scoring} page returned no usable rows")
    return ProviderFetchResult(rows=rows)


def _parse_ffc_json_rows(response_json: object) -> dict[tuple[str, str], ProviderRow]:
    if not isinstance(response_json, dict):
        return {}
    players = response_json.get("players")
    if not isinstance(players, list):
        return {}

    rows: dict[tuple[str, str], ProviderRow] = {}
    for player in players:
        if not isinstance(player, dict):
            continue
        name = _player_name(player)
        position = str(player.get("position", "")).strip().upper()
        adp_pick = _player_adp(player)
        if not name or not position or adp_pick is None:
            continue
        rows[_player_key(name, position)] = ProviderRow(
            player=name,
            position=position,
            adp_pick=adp_pick,
            nfl_team=_string(player.get("team")) or _string(player.get("nfl_team")),
        )
    return rows


def _parse_ffc_html_rows(html_text: str) -> dict[tuple[str, str], ProviderRow]:
    rows: dict[tuple[str, str], ProviderRow] = {}
    for row_match in re.finditer(r"<tr class='([A-Z]+)'>.*?</tr>", html_text, re.DOTALL):
        row_html = row_match.group(0)
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row_html, re.DOTALL)
        if len(cells) < 6:
            continue

        name = _clean_html_cell(cells[1])
        position = _clean_html_cell(cells[2]).upper()
        nfl_team = _clean_html_cell(cells[3]).upper()
        adp_pick = _parse_numeric_cell(cells[5])
        if not name or not position or adp_pick is None:
            continue
        rows[_player_key(name, position)] = ProviderRow(
            player=name,
            position=position,
            adp_pick=adp_pick,
            nfl_team=nfl_team or None,
        )
    return rows


def _clean_html_cell(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_numeric_cell(value: str) -> float | None:
    text = _clean_html_cell(value)
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _fetch_sleeper_players(settings: Settings) -> dict[tuple[str, str], dict[str, str]]:
    try:
        payload = _read_remote_payload(
            settings.sleeper_players_url,
            settings,
            accept_header="application/json, */*;q=0.5",
        )
        response_json = json.loads(payload.decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, UnicodeDecodeError, json.JSONDecodeError, OSError):
        return {}

    if not isinstance(response_json, dict):
        return {}

    players: dict[tuple[str, str], dict[str, str]] = {}
    for player in response_json.values():
        if not isinstance(player, dict):
            continue
        full_name = _string(player.get("full_name"))
        position = _string(player.get("position")).upper()
        if not full_name or not position:
            continue
        players[_player_key(full_name, position)] = {
            "full_name": full_name,
            "position": position,
            "team": _string(player.get("team")),
        }
    return players


def _read_remote_payload(
    request_url: str,
    settings: Settings,
    *,
    accept_header: str,
) -> bytes:
    request = urllib.request.Request(
        request_url,
        headers={
            "Accept": accept_header,
            "User-Agent": "keeper-optimizer-composite-adp/0.1",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=settings.adp_refresh_timeout_seconds) as response:
        return response.read()


def _player_name(player: dict[str, object]) -> str:
    for key in ("name", "player_name", "display_name"):
        value = player.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _player_adp(player: dict[str, object]) -> float | None:
    for key in ("adp", "adp_pick", "overall_rank", "rank"):
        parsed = _coerce_float(player.get(key))
        if parsed is not None:
            return parsed
    return None


def _coerce_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _player_key(name: str, position: str) -> tuple[str, str]:
    normalized_name = re.sub(r"[^a-z0-9]+", "", name.casefold())
    normalized_name = normalized_name.removesuffix("jr").removesuffix("sr").removesuffix("iii").removesuffix("ii")
    return normalized_name, position.strip().upper()


def _team_count(session: Session, league: League) -> int:
    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    return len(teams) or 12


def _fmt(value: float | None) -> str:
    return f"{value:g}" if value is not None else ""


def _string(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]
