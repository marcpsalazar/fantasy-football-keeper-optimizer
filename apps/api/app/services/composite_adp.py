from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date
from html import unescape
import json
from pathlib import Path
import re
import subprocess
from typing import Any
import urllib.error
import urllib.parse
import urllib.request
import uuid

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import ADPEntry, ADPSnapshot, DraftPick, FinalRosterEntry, League, Player, Team
from app.services.yahoo_oauth import YahooAPIError, yahoo_get


class CompositeADPError(Exception):
    """Raised when a composite ADP export cannot be built."""


PUBLIC_DRAFTSHARKS_ROW_LIMIT = 26
MAX_ROUND_PICK_ROUND = 30

_DISAGREEMENT_THRESHOLD = 40.0
_SINGLE_SOURCE_REVIEW_ADP_CUTOFF = 150.0
_MOVEMENT_NOTABLE_EARLY = 15.0   # notable move for players in/near top 100
_MOVEMENT_NOTABLE = 30.0          # notable move for players outside top 100


@dataclass(frozen=True)
class ProviderRow:
    player: str
    position: str
    adp_pick: float
    nfl_team: str | None = None
    sos: float | None = None
    injury: float | None = None
    risk: float | None = None
    floor_projection: float | None = None
    consensus_projection: float | None = None
    draftsharks_projection: float | None = None
    ceiling_projection: float | None = None
    draftsharks_3d_value: float | None = None


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
    yahoo_adp: float | None
    existing_adp: float | None
    review_flag: str
    source_count: int = 0
    adp_spread: float | None = None
    disagreement_flag: bool = False
    sleeper_player_id: str | None = None
    sleeper_status: str = ""
    adp_movement: float | None = None
    movement_flag: str = ""
    sos: float | None = None
    injury: float | None = None
    risk: float | None = None
    floor_projection: float | None = None
    consensus_projection: float | None = None
    draftsharks_projection: float | None = None
    ceiling_projection: float | None = None
    draftsharks_3d_value: float | None = None


@dataclass
class CompositeBuildResult:
    rows: list[dict[str, str]]
    coverage: dict[str, Any]


def _compute_coverage_summary(
    candidates: list[CompositeCandidate],
    league_keys: frozenset[tuple[str, str]],
) -> dict[str, Any]:
    source_counts = Counter(c.source_count for c in candidates)
    review_flag_counts = Counter(c.review_flag for c in candidates if c.review_flag)
    movement_dirs = Counter(
        "riser" if c.movement_flag.startswith("riser") else "faller"
        for c in candidates
        if c.movement_flag
    )

    top_150 = [c for c in candidates if c.composite_adp is not None and c.composite_adp <= 150]
    top_150_multi = sum(1 for c in top_150 if c.source_count >= 2)
    top_150_pct = round(100.0 * top_150_multi / len(top_150), 1) if top_150 else None

    roster_candidates = [c for c in candidates if candidate_key(c) in league_keys]
    roster_missing = sum(1 for c in roster_candidates if c.source_count == 0)

    return {
        "total_players": len(candidates),
        "source_coverage": {str(k): source_counts[k] for k in range(5)},
        "review_flag_counts": dict(review_flag_counts),
        "top_150": {
            "total": len(top_150),
            "multi_source_count": top_150_multi,
            "multi_source_pct": top_150_pct,
        },
        "movement": {
            "risers": movement_dirs.get("riser", 0),
            "fallers": movement_dirs.get("faller", 0),
        },
        "roster_players": {
            "total": len(roster_candidates),
            "missing_adp": roster_missing,
        },
    }


def build_composite_adp_template_rows(
    session: Session,
    league: League,
    settings: Settings,
    yahoo_access_token: str | None = None,
) -> CompositeBuildResult:
    team_count = _team_count(session, league)
    _, current_entries = _load_current_snapshot(session, league.id)
    current_by_key = {
        _player_key(player.full_name, player.position): (player, entry)
        for player, entry in current_entries
        if not _is_snapshot_placeholder(player.full_name)
    }

    source_draftsharks = _fetch_draftsharks_superflex_rows(settings, team_count)
    source_ffc_2qb = _fetch_ffc_rows(settings, league, team_count, "2qb")
    source_ffc_ppr = _fetch_ffc_rows(settings, league, team_count, "ppr")
    source_yahoo = (
        _fetch_yahoo_adp_rows(yahoo_access_token, settings)
        if yahoo_access_token
        else ProviderFetchResult(rows={})
    )
    sleeper_players = _fetch_sleeper_players(settings)

    if not source_draftsharks.rows and not source_ffc_2qb.rows and not source_ffc_ppr.rows:
        source_errors = [
            err
            for err in [source_draftsharks.error, source_ffc_2qb.error, source_ffc_ppr.error]
            if err
        ]
        raise CompositeADPError(
            "Composite ADP build failed: no external ADP sources returned usable rows."
            + (f" Details: {'; '.join(source_errors)}" if source_errors else "")
        )

    league_players = _load_league_players(session, league.id)
    league_keys = {_player_key(player.full_name, player.position) for player in league_players}
    league_player_by_key = {
        _player_key(player.full_name, player.position): player for player in league_players
    }

    provider_keys = (
        set(source_draftsharks.rows)
        | set(source_ffc_2qb.rows)
        | set(source_ffc_ppr.rows)
        | set(source_yahoo.rows)
    )
    focus_limit = max(300, team_count * 25)
    early_board_cutoff = max(120, team_count * 10)

    candidate_cache: dict[tuple[str, str], CompositeCandidate] = {}

    def resolve_candidate(key: tuple[str, str]) -> CompositeCandidate:
        if key not in candidate_cache:
            candidate_cache[key] = _build_candidate(
                key,
                scoring_format=league.scoring_format,
                source_draftsharks=source_draftsharks.rows,
                source_ffc_2qb=source_ffc_2qb.rows,
                source_ffc_ppr=source_ffc_ppr.rows,
                source_yahoo=source_yahoo.rows,
                sleeper_players=sleeper_players,
                current_by_key=current_by_key,
                league_player_by_key=league_player_by_key,
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
    sorted_candidates = [resolve_candidate(key) for key in sorted_keys]
    rows = [
        _candidate_row(candidate, league=league, team_count=team_count)
        for candidate in sorted_candidates
    ]

    if not rows:
        raise CompositeADPError("No league players or ADP source rows were available to build the composite CSV")

    coverage = _compute_coverage_summary(composite_candidates, frozenset(league_keys))
    return CompositeBuildResult(rows=rows, coverage=coverage)


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


def _compute_movement(
    composite_adp: float | None,
    existing_adp: float | None,
) -> tuple[float | None, str]:
    if composite_adp is None or existing_adp is None:
        return None, ""
    delta = composite_adp - existing_adp
    threshold = (
        _MOVEMENT_NOTABLE_EARLY
        if composite_adp <= 100 or existing_adp <= 100
        else _MOVEMENT_NOTABLE
    )
    if abs(delta) < threshold:
        return delta, ""
    if delta < 0:
        return delta, f"riser_{abs(delta):.0f}"
    return delta, f"faller_{delta:.0f}"


def _build_candidate(
    key: tuple[str, str],
    *,
    scoring_format: str,
    source_draftsharks: dict[tuple[str, str], ProviderRow],
    source_ffc_2qb: dict[tuple[str, str], ProviderRow],
    source_ffc_ppr: dict[tuple[str, str], ProviderRow],
    source_yahoo: dict[tuple[str, str], ProviderRow],
    sleeper_players: dict[tuple[str, str], dict[str, str]],
    current_by_key: dict[tuple[str, str], tuple[Player, ADPEntry]],
    league_player_by_key: dict[tuple[str, str], Player] | None = None,
) -> CompositeCandidate:
    draftsharks_row = source_draftsharks.get(key)
    ffc_2qb_row = source_ffc_2qb.get(key)
    ffc_ppr_row = source_ffc_ppr.get(key)
    yahoo_row = source_yahoo.get(key)
    current = current_by_key.get(key)
    sleeper = sleeper_players.get(key)
    league_player = league_player_by_key.get(key) if league_player_by_key else None

    sleeper_player_id = _string(sleeper.get("player_id")) if sleeper else None
    sleeper_status = _string(sleeper.get("status")) if sleeper else ""

    # Snapshot name is user-entered (authoritative); Sleeper is the canonical NFL source.
    player_name = (
        (current[0].full_name if current else None)
        or (sleeper.get("full_name") if sleeper else None)
        or (draftsharks_row.player if draftsharks_row else None)
        or (ffc_2qb_row.player if ffc_2qb_row else None)
        or (ffc_ppr_row.player if ffc_ppr_row else None)
        or (yahoo_row.player if yahoo_row else None)
        or (league_player.full_name if league_player else "")
    )
    position = _normalize_position(
        (current[0].position if current else None)
        or (draftsharks_row.position if draftsharks_row else None)
        or (ffc_2qb_row.position if ffc_2qb_row else None)
        or (ffc_ppr_row.position if ffc_ppr_row else None)
        or (yahoo_row.position if yahoo_row else None)
        or (sleeper.get("position") if sleeper else "")
        or ""
    )
    # Sleeper team is live (updated daily for trades/releases) — highest non-user priority.
    nfl_team = (
        (sleeper.get("team") if sleeper and sleeper.get("team") else None)
        or (draftsharks_row.nfl_team if draftsharks_row and draftsharks_row.nfl_team else None)
        or (ffc_2qb_row.nfl_team if ffc_2qb_row and ffc_2qb_row.nfl_team else None)
        or (ffc_ppr_row.nfl_team if ffc_ppr_row and ffc_ppr_row.nfl_team else None)
        or (yahoo_row.nfl_team if yahoo_row and yahoo_row.nfl_team else None)
        or (current[0].nfl_team if current and current[0].nfl_team else None)
    )
    existing_adp = current[1].adp_pick if current else None
    # Don't carry forward snapshot ADPs that are implausibly early for K/DST —
    # they reflect stale/bad imports and would block composite re-import.
    canonical_pos = _normalize_position(position or key[1])
    if canonical_pos in ("K", "DST") and existing_adp is not None and existing_adp < 100:
        existing_adp = None
    # DS kicker/DST rankings are unreliable — exclude from composite for those positions
    ds_adp_for_composite = (
        None
        if canonical_pos in ("K", "DST")
        else (draftsharks_row.adp_pick if draftsharks_row else None)
    )
    composite_adp, composite_method, source_count, adp_spread, disagreement_flag = _compose_adp(
        scoring_format=scoring_format,
        position=canonical_pos,
        draftsharks_adp=ds_adp_for_composite,
        ffc_2qb_adp=ffc_2qb_row.adp_pick if ffc_2qb_row else None,
        ffc_ppr_adp=ffc_ppr_row.adp_pick if ffc_ppr_row else None,
        yahoo_adp=yahoo_row.adp_pick if yahoo_row else None,
        existing_adp=existing_adp,
    )
    adp_movement, movement_flag = _compute_movement(composite_adp, existing_adp)
    review_flag = _review_flag(
        position=position or key[1],
        composite_adp=composite_adp,
        source_count=source_count,
        adp_spread=adp_spread,
        nfl_team=nfl_team,
        sleeper_status=sleeper_status,
    )

    return CompositeCandidate(
        player=player_name or key[0],
        position=position or key[1],
        nfl_team=nfl_team,
        composite_adp=composite_adp,
        composite_method=composite_method,
        draftsharks_adp=draftsharks_row.adp_pick if draftsharks_row else None,
        ffc_2qb_adp=ffc_2qb_row.adp_pick if ffc_2qb_row else None,
        ffc_ppr_adp=ffc_ppr_row.adp_pick if ffc_ppr_row else None,
        yahoo_adp=yahoo_row.adp_pick if yahoo_row else None,
        existing_adp=existing_adp,
        source_count=source_count,
        adp_spread=adp_spread,
        disagreement_flag=disagreement_flag,
        sleeper_player_id=sleeper_player_id or None,
        sleeper_status=sleeper_status,
        adp_movement=adp_movement,
        movement_flag=movement_flag,
        review_flag=review_flag,
        sos=draftsharks_row.sos if draftsharks_row else None,
        injury=draftsharks_row.injury if draftsharks_row else None,
        risk=draftsharks_row.risk if draftsharks_row else None,
        floor_projection=draftsharks_row.floor_projection if draftsharks_row else None,
        consensus_projection=draftsharks_row.consensus_projection if draftsharks_row else None,
        draftsharks_projection=draftsharks_row.draftsharks_projection if draftsharks_row else None,
        ceiling_projection=draftsharks_row.ceiling_projection if draftsharks_row else None,
        draftsharks_3d_value=draftsharks_row.draftsharks_3d_value if draftsharks_row else None,
    )


def _source_weights(scoring_format: str, position: str = "") -> dict[str, float]:
    fmt = scoring_format.strip().lower()
    if fmt in ("superflex", "2qb"):
        if position.upper() == "QB":
            # QBs: 2QB format is highly relevant — keep 2QB as primary FFC source.
            # Yahoo superflex leagues are rare so their QB ADP is diluted by standard drafts.
            return {"draftsharks": 1.3, "ffc_2qb": 0.85, "ffc_ppr": 0.35, "yahoo": 0.20, "existing": 0.15}
        else:
            # Skill positions: FFC 2QB communities over-draft QBs, pushing WR/RB/TE too late.
            # PPR is a more reliable proxy for non-QB skill position values in superflex.
            return {"draftsharks": 1.3, "ffc_2qb": 0.35, "ffc_ppr": 0.85, "yahoo": 0.70, "existing": 0.15}
    if fmt == "ppr":
        return {"draftsharks": 0.45, "ffc_2qb": 0.35, "ffc_ppr": 1.0, "yahoo": 0.90, "existing": 0.15}
    # half-ppr, standard
    return {"draftsharks": 0.40, "ffc_2qb": 0.30, "ffc_ppr": 0.90, "yahoo": 0.80, "existing": 0.15}


def _weighted_median(values_weights: list[tuple[float, float]]) -> float:
    sorted_vw = sorted(values_weights, key=lambda item: item[0])
    total = sum(w for _, w in sorted_vw)
    cumulative = 0.0
    for value, weight in sorted_vw:
        cumulative += weight
        if cumulative >= total / 2.0:
            return value
    return sorted_vw[-1][0]


def _compose_adp(
    *,
    scoring_format: str,
    position: str = "",
    draftsharks_adp: float | None,
    ffc_2qb_adp: float | None,
    ffc_ppr_adp: float | None,
    yahoo_adp: float | None,
    existing_adp: float | None,
) -> tuple[float | None, str, int, float | None, bool]:
    weights = _source_weights(scoring_format, position)

    real_sources: list[tuple[float, float, str]] = []
    if draftsharks_adp is not None:
        real_sources.append((draftsharks_adp, weights["draftsharks"], "draftsharks"))
    if ffc_2qb_adp is not None:
        real_sources.append((ffc_2qb_adp, weights["ffc_2qb"], "ffc_2qb"))
    if ffc_ppr_adp is not None:
        real_sources.append((ffc_ppr_adp, weights["ffc_ppr"], "ffc_ppr"))
    if yahoo_adp is not None:
        real_sources.append((yahoo_adp, weights["yahoo"], "yahoo"))

    source_count = len(real_sources)

    all_sources = list(real_sources)
    if source_count < 2 and existing_adp is not None:
        all_sources.append((existing_adp, weights["existing"], "existing"))

    if not all_sources:
        return None, "missing", 0, None, False

    if len(all_sources) == 1:
        value, _, name = all_sources[0]
        return value, f"{name}_only", source_count, None, False

    values = [v for v, _, _ in all_sources]
    adp_spread = max(values) - min(values)
    disagreement_flag = adp_spread >= _DISAGREEMENT_THRESHOLD

    composite = _weighted_median([(v, w) for v, w, _ in all_sources])
    source_names = "+".join(name for _, _, name in all_sources)
    method = f"weighted_median_{source_names}"

    return composite, method, source_count, adp_spread, disagreement_flag


_SLEEPER_INACTIVE_STATUSES = frozenset({"Inactive", "IR", "PUP", "SUS", "NFI", "NA"})


def _review_flag(
    *,
    position: str,
    composite_adp: float | None,
    source_count: int,
    adp_spread: float | None,
    nfl_team: str | None,
    sleeper_status: str = "",
) -> str:
    if composite_adp is None and source_count == 0:
        return "missing_all_sources"
    if (
        sleeper_status in _SLEEPER_INACTIVE_STATUSES
        and composite_adp is not None
        and composite_adp <= _SINGLE_SOURCE_REVIEW_ADP_CUTOFF
    ):
        return f"sleeper_{sleeper_status.lower()}_top150"
    if source_count < 2 and composite_adp is not None and composite_adp <= _SINGLE_SOURCE_REVIEW_ADP_CUTOFF:
        return "single_source_top150"
    if adp_spread is not None and adp_spread >= _DISAGREEMENT_THRESHOLD:
        return f"source_disagreement_{adp_spread:.0f}picks"
    pos = position.strip().upper()
    if (
        pos in ("QB", "RB", "WR", "TE")
        and nfl_team is None
        and composite_adp is not None
        and composite_adp <= _SINGLE_SOURCE_REVIEW_ADP_CUTOFF
    ):
        return "missing_nfl_team"
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
        "yahoo_adp": _fmt(candidate.yahoo_adp),
        "existing_adp": _fmt(candidate.existing_adp),
        "composite_method": candidate.composite_method,
        "source_count": str(candidate.source_count),
        "adp_spread": _fmt(candidate.adp_spread),
        "disagreement_flag": "1" if candidate.disagreement_flag else "",
        "sleeper_player_id": candidate.sleeper_player_id or "",
        "sleeper_status": candidate.sleeper_status,
        "adp_movement": _fmt(candidate.adp_movement),
        "movement_flag": candidate.movement_flag,
        "review_flag": candidate.review_flag,
        "sos": _fmt(candidate.sos),
        "injury": _fmt(candidate.injury),
        "risk": _fmt(candidate.risk),
        "floor": _fmt(candidate.floor_projection),
        "consensus_proj": _fmt(candidate.consensus_projection),
        "ds_proj": _fmt(candidate.draftsharks_projection),
        "ceiling": _fmt(candidate.ceiling_projection),
        "3d_value": _fmt(candidate.draftsharks_3d_value),
    }


def _source_note(candidate: CompositeCandidate) -> str:
    parts: list[str] = []
    if candidate.draftsharks_adp is not None:
        parts.append(f"DS:{candidate.draftsharks_adp:g}")
    if candidate.ffc_2qb_adp is not None:
        parts.append(f"FFC2QB:{candidate.ffc_2qb_adp:g}")
    if candidate.ffc_ppr_adp is not None:
        parts.append(f"FFCPPR:{candidate.ffc_ppr_adp:g}")
    if candidate.yahoo_adp is not None:
        parts.append(f"Y:{candidate.yahoo_adp:g}")
    if candidate.existing_adp is not None:
        parts.append(f"prev:{candidate.existing_adp:g}")
    if candidate.review_flag:
        parts.append(f"review:{candidate.review_flag}")
    return "; ".join(parts)


def _export_adp_pick(candidate: CompositeCandidate) -> float | None:
    if candidate.composite_adp is None:
        return None
    return float(round(candidate.composite_adp))


def _fetch_draftsharks_superflex_rows(settings: Settings, team_count: int) -> ProviderFetchResult:
    request_url = settings.draftsharks_superflex_adp_url
    browser_result = _fetch_draftsharks_browser_rows(settings, team_count)
    if browser_result.rows:
        return browser_result

    try:
        payload = _read_remote_payload(
            request_url,
            settings,
            accept_header="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        html_text = payload.decode("utf-8")
        rows = _parse_draftsharks_superflex_rows(html_text, team_count)
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


def _fetch_draftsharks_browser_rows(settings: Settings, team_count: int) -> ProviderFetchResult:
    try:
        script_path = _repo_root() / "scripts" / "draftsharks_scrape.mjs"
    except IndexError:
        return ProviderFetchResult(rows={}, error="DraftSharks browser scraper unavailable in this environment")
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

    rows = _parse_draftsharks_browser_payload(payload, team_count)
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


def _parse_draftsharks_browser_payload(
    payload: object,
    team_count: int,
) -> dict[tuple[str, str], ProviderRow]:
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
        adp_pick = _draftsharks_overall_pick(
            row.get("adp_pick"),
            team_count,
        )
        if not player or not position or adp_pick is None or adp_pick <= 0:
            continue
        position = "DST" if position == "DEF" else position
        canonical_pos = _normalize_position(position)
        if canonical_pos in ("K", "DST") and adp_pick < 100:
            continue
        rows[_player_key(player, position)] = ProviderRow(
            player=player,
            position=position,
            adp_pick=adp_pick,
            nfl_team=nfl_team,
            sos=_coerce_float(row.get("sos")),
            injury=_coerce_float(row.get("injury")),
            risk=_coerce_float(row.get("risk")),
            floor_projection=_coerce_float(row.get("floor_projection")),
            consensus_projection=_coerce_float(row.get("consensus_projection")),
            draftsharks_projection=_coerce_float(row.get("draftsharks_projection")),
            ceiling_projection=_coerce_float(row.get("ceiling_projection")),
            draftsharks_3d_value=_coerce_float(row.get("draftsharks_3d_value")),
        )
    return rows


def _parse_draftsharks_superflex_rows(
    html_text: str,
    team_count: int,
) -> dict[tuple[str, str], ProviderRow]:
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
            adp_pick=_draftsharks_overall_pick(
                match.group("adp"),
                team_count,
                rank=match.group("rank"),
            )
            or float(match.group("rank")),
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
        position = _normalize_position(str(player.get("position", "")))
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
        position = _normalize_position(_clean_html_cell(cells[2]))
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


def _draftsharks_overall_pick(
    value: object,
    team_count: int,
    *,
    rank: object | None = None,
) -> float | None:
    rank_text = str(rank).strip() if rank is not None else ""
    if rank_text.isdigit():
        parsed_rank = int(rank_text)
        if parsed_rank > 0:
            return float(parsed_rank)

    return _round_pick_to_overall(value, team_count) or _coerce_float(value)


def _round_pick_to_overall(value: object, team_count: int) -> float | None:
    if team_count <= 0:
        return None

    text = str(value).strip() if value is not None else ""
    if not text or "." not in text:
        return None

    round_text, pick_text = text.split(".", 1)
    if not round_text.isdigit() or not pick_text.isdigit() or len(pick_text) > 2:
        return None

    round_number = int(round_text)
    pick_in_round = int(pick_text) if len(pick_text) == 2 else int(pick_text) * 10
    if (
        round_number <= 0
        or round_number > MAX_ROUND_PICK_ROUND
        or pick_in_round <= 0
        or pick_in_round > team_count
    ):
        return None

    return float((round_number - 1) * team_count + pick_in_round)


def _fetch_yahoo_adp_rows(access_token: str, settings: Settings) -> ProviderFetchResult:
    rows: dict[tuple[str, str], ProviderRow] = {}
    page_size = 25
    player_limit = settings.adp_yahoo_player_limit

    for start in range(0, player_limit, page_size):
        try:
            data = yahoo_get(
                f"game/nfl/players;sort=DA_AP;count={page_size};start={start};out=draft_analysis",
                access_token,
            )
        except YahooAPIError as exc:
            if not rows:
                return ProviderFetchResult(rows={}, error=f"Yahoo ADP fetch failed: {exc}")
            break

        game_data = data.get("fantasy_content", {}).get("game", [])
        if len(game_data) < 2 or not isinstance(game_data[1], dict):
            break

        players_data = game_data[1].get("players", {})
        if not isinstance(players_data, dict):
            break
        count = int(players_data.get("count", 0))
        if count == 0:
            break

        for i in range(count):
            player_item = players_data.get(str(i), {}).get("player", [])
            if not isinstance(player_item, list) or len(player_item) < 2:
                continue

            attr_list = player_item[0] if isinstance(player_item[0], list) else []
            attrs: dict[str, object] = {}
            for attr in attr_list:
                if isinstance(attr, dict):
                    attrs.update(attr)

            name_data = attrs.get("name", {})
            full_name = name_data.get("full", "") if isinstance(name_data, dict) else ""
            full_name = _string(full_name)
            if not full_name:
                continue

            position = _normalize_position(_string(attrs.get("display_position", "")))
            if position not in ("QB", "RB", "WR", "TE", "K", "DST", "DEF"):
                continue
            position = "DST" if position == "DEF" else position

            nfl_team = _string(attrs.get("editorial_team_abbr", "")).upper() or None

            sub = player_item[1] if isinstance(player_item[1], dict) else {}
            draft_analysis = sub.get("draft_analysis", {})
            if not isinstance(draft_analysis, dict):
                continue
            avg_pick = _coerce_float(draft_analysis.get("average_pick"))
            if avg_pick is None or avg_pick <= 0:
                continue

            canonical_pos = _normalize_position(position)
            if canonical_pos in ("K", "DST") and avg_pick < 100:
                continue

            rows[_player_key(full_name, position)] = ProviderRow(
                player=full_name,
                position=position,
                adp_pick=avg_pick,
                nfl_team=nfl_team,
            )

        if count < page_size:
            break

    if not rows:
        return ProviderFetchResult(rows={}, error="Yahoo ADP returned no usable rows")
    return ProviderFetchResult(rows=rows)


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
        position = _normalize_position(_string(player.get("position")))
        if not full_name or not position:
            continue
        team = _string(player.get("team")) or None
        players[_player_key(full_name, position)] = {
            "player_id": _string(player.get("player_id")),
            "full_name": full_name,
            "position": position,
            "team": team,
            "status": _string(player.get("status")),
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


def _normalize_position(position: str) -> str:
    pos = position.strip().upper()
    if pos == "PK":
        return "K"
    if pos == "DEF":
        return "DST"
    return pos


def _player_key(name: str, position: str) -> tuple[str, str]:
    normalized_name = re.sub(r"[^a-z0-9]+", "", name.casefold())
    normalized_name = normalized_name.removesuffix("jr").removesuffix("sr").removesuffix("iii").removesuffix("ii")
    return normalized_name, _normalize_position(position)


def _team_count(session: Session, league: League) -> int:
    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    return len(teams) or 12


def _fmt(value: float | None) -> str:
    return f"{value:g}" if value is not None else ""


def _string(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _is_snapshot_placeholder(name: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]", "", name.casefold())
    return "placeholder" in normalized or normalized.startswith("sourcenotsubstantiated")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]
