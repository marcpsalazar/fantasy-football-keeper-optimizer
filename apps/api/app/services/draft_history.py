"""Cross-season owner draft profile builder.

Profiles are computed at mock draft session creation time and cached inside
MockDraftSession.bot_config so no per-pick DB queries are needed.
"""
from __future__ import annotations

import re
import uuid
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from typing import Any

from sqlmodel import Session, select

from app.models import ADPEntry, ADPSnapshot, DraftPick, KeeperCandidate, League, Player, Team

MIN_PICKS_FOR_PROFILE = 8
_ROUND_BANDS = {
    "early": (1, 4),
    "mid": (5, 9),
    "late": (10, 999),
}


@dataclass(frozen=True)
class OwnerDraftProfile:
    owner_name: str | None
    seasons_found: list[int]
    seasons_with_data: int
    position_pick_rates: dict[str, float]
    early_round_positions: dict[str, float]
    mid_round_positions: dict[str, float]
    late_round_positions: dict[str, float]
    adp_tendency: float
    position_adp_tendencies: dict[str, float]
    keeper_positions: list[str]
    keeper_count_avg: float
    total_picks_analyzed: int


def get_owner_draft_profile(
    session: Session,
    league_name: str,
    target_team_id: uuid.UUID,
    *,
    current_season_year: int,
    seasons_lookback: int = 5,
) -> OwnerDraftProfile | None:
    """Return a draft profile for a team based on historical pick data.

    Returns None if there is insufficient history (fewer than MIN_PICKS_FOR_PROFILE picks).
    """
    team = session.get(Team, target_team_id)
    if team is None:
        return None

    historical_pairs = _find_historical_teams(
        session,
        league_name,
        team.user_id,
        team.owner_name,
        current_season_year=current_season_year,
        seasons_lookback=seasons_lookback,
    )
    if not historical_pairs:
        return None

    return _build_profile(session, team.owner_name, historical_pairs)


def get_league_draft_profiles(
    session: Session,
    league_id: uuid.UUID,
    league_name: str,
    current_season_year: int,
    *,
    seasons_lookback: int = 5,
) -> dict[uuid.UUID, OwnerDraftProfile]:
    """Return profiles for all teams in a league, keyed by team_id.

    Teams with insufficient history are omitted.
    Deduplicates owners so the same person is only computed once.
    """
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    profiles: dict[uuid.UUID, OwnerDraftProfile] = {}
    seen_owners: dict[tuple[uuid.UUID | None, str | None], OwnerDraftProfile] = {}

    for team in teams:
        owner_key = (team.user_id, _normalize_name(team.owner_name))
        if owner_key in seen_owners:
            profiles[team.id] = seen_owners[owner_key]
            continue
        try:
            profile = get_owner_draft_profile(
                session,
                league_name,
                team.id,
                current_season_year=current_season_year,
                seasons_lookback=seasons_lookback,
            )
        except Exception:
            continue
        if profile is not None:
            profiles[team.id] = profile
            seen_owners[owner_key] = profile

    return profiles


def profile_to_dict(profile: OwnerDraftProfile) -> dict[str, Any]:
    return asdict(profile)


def profile_from_dict(data: dict[str, Any]) -> OwnerDraftProfile | None:
    if not isinstance(data, dict):
        return None
    try:
        return OwnerDraftProfile(
            owner_name=data.get("owner_name"),
            seasons_found=list(data.get("seasons_found") or []),
            seasons_with_data=int(data.get("seasons_with_data", 0)),
            position_pick_rates=dict(data.get("position_pick_rates") or {}),
            early_round_positions=dict(data.get("early_round_positions") or {}),
            mid_round_positions=dict(data.get("mid_round_positions") or {}),
            late_round_positions=dict(data.get("late_round_positions") or {}),
            adp_tendency=float(data.get("adp_tendency", 0.0)),
            position_adp_tendencies=dict(data.get("position_adp_tendencies") or {}),
            keeper_positions=list(data.get("keeper_positions") or []),
            keeper_count_avg=float(data.get("keeper_count_avg", 0.0)),
            total_picks_analyzed=int(data.get("total_picks_analyzed", 0)),
        )
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _normalize_name(name: str | None) -> str | None:
    if name is None:
        return None
    return re.sub(r"\s+", " ", name.strip().lower())


def _find_historical_teams(
    session: Session,
    league_name: str,
    user_id: uuid.UUID | None,
    owner_name: str | None,
    *,
    current_season_year: int,
    seasons_lookback: int,
) -> list[tuple[int, uuid.UUID]]:
    """Return (season_year, team_id) pairs from past seasons, newest first."""
    past_leagues = session.exec(
        select(League)
        .where(League.name == league_name, League.season_year < current_season_year)
        .order_by(League.season_year.desc())
        .limit(seasons_lookback)
    ).all()

    pairs: list[tuple[int, uuid.UUID]] = []
    norm_owner = _normalize_name(owner_name)

    for league in past_leagues:
        team: Team | None = None

        if user_id is not None:
            team = session.exec(
                select(Team).where(Team.league_id == league.id, Team.user_id == user_id)
            ).first()

        if team is None and norm_owner:
            candidates = session.exec(
                select(Team).where(
                    Team.league_id == league.id,
                    Team.owner_name.isnot(None),  # type: ignore[attr-defined]
                )
            ).all()
            for c in candidates:
                if _normalize_name(c.owner_name) == norm_owner:
                    team = c
                    break

        if team is not None:
            pairs.append((league.season_year, team.id))

    return pairs


def _build_profile(
    session: Session,
    owner_name: str | None,
    historical_pairs: list[tuple[int, uuid.UUID]],
) -> OwnerDraftProfile | None:
    seasons_found = [season for season, _ in historical_pairs]
    team_ids = [team_id for _, team_id in historical_pairs]

    picks = session.exec(
        select(DraftPick).where(DraftPick.team_id.in_(team_ids))  # type: ignore[attr-defined]
    ).all()

    if len(picks) < MIN_PICKS_FOR_PROFILE:
        return None

    # Group picks by team to identify seasons with data
    teams_with_picks: set[uuid.UUID] = {p.team_id for p in picks}
    seasons_with_data = sum(1 for _, tid in historical_pairs if tid in teams_with_picks)

    # Position rates overall and by round band
    position_pick_rates = _position_rates(picks)
    early_round_positions = _position_rates([p for p in picks if 1 <= p.round <= 4])
    mid_round_positions = _position_rates([p for p in picks if 5 <= p.round <= 9])
    late_round_positions = _position_rates([p for p in picks if p.round >= 10])

    # ADP tendency: positive means owner drafts value (picks later than ADP suggests)
    adp_tendency, position_adp_tendencies = _compute_adp_tendencies(session, picks, historical_pairs)

    # Keeper history
    keeper_candidates = session.exec(
        select(KeeperCandidate).where(KeeperCandidate.team_id.in_(team_ids))  # type: ignore[attr-defined]
    ).all()
    keeper_positions, keeper_count_avg = _keeper_stats(session, keeper_candidates, historical_pairs)

    return OwnerDraftProfile(
        owner_name=owner_name,
        seasons_found=seasons_found,
        seasons_with_data=seasons_with_data,
        position_pick_rates=position_pick_rates,
        early_round_positions=early_round_positions,
        mid_round_positions=mid_round_positions,
        late_round_positions=late_round_positions,
        adp_tendency=round(adp_tendency, 2),
        position_adp_tendencies={k: round(v, 2) for k, v in position_adp_tendencies.items()},
        keeper_positions=keeper_positions,
        keeper_count_avg=round(keeper_count_avg, 1),
        total_picks_analyzed=len(picks),
    )


def _position_rates(picks: list[DraftPick]) -> dict[str, float]:
    if not picks:
        return {}
    counts: Counter[str] = Counter(_norm_pos(p.position) for p in picks)
    total = len(picks)
    return {pos: round(count / total, 3) for pos, count in counts.most_common()}


def _norm_pos(pos: str) -> str:
    p = pos.upper().strip()
    if p in ("D/ST", "DST", "DEF"):
        return "DST"
    return p


def _compute_adp_tendencies(
    session: Session,
    picks: list[DraftPick],
    historical_pairs: list[tuple[int, uuid.UUID]],
) -> tuple[float, dict[str, float]]:
    """Compute mean(adp_pick - actual_pick) overall and per position.

    Positive = owner tends to draft players later than their ADP (value drafter).
    Returns (overall_tendency, {position: tendency}).
    Best-effort: picks without matching ADP data are skipped.
    """
    # Map team_id -> league_id for the picks we have
    team_league_map: dict[uuid.UUID, uuid.UUID] = {}
    for season_year, team_id in historical_pairs:
        team = session.get(Team, team_id)
        if team is not None:
            team_league_map[team_id] = team.league_id

    # Find latest ADP snapshot per league
    league_ids = list({lid for lid in team_league_map.values()})
    adp_by_player: dict[uuid.UUID, dict[uuid.UUID, float]] = defaultdict(dict)

    for league_id in league_ids:
        snapshot = session.exec(
            select(ADPSnapshot)
            .where(ADPSnapshot.league_id == league_id)
            .order_by(ADPSnapshot.snapshot_date.desc())
            .limit(1)
        ).first()
        if snapshot is None:
            continue
        entries = session.exec(
            select(ADPEntry).where(ADPEntry.snapshot_id == snapshot.id)
        ).all()
        for entry in entries:
            adp_by_player[entry.player_id][league_id] = entry.adp_pick

    # Compute deviations
    deviations: list[float] = []
    pos_deviations: dict[str, list[float]] = defaultdict(list)

    for pick in picks:
        league_id = team_league_map.get(pick.team_id)
        if league_id is None:
            continue
        player_adp = adp_by_player.get(pick.player_id, {}).get(league_id)
        if player_adp is None:
            continue
        deviation = player_adp - pick.overall_pick
        deviations.append(deviation)
        pos_deviations[_norm_pos(pick.position)].append(deviation)

    overall = sum(deviations) / len(deviations) if deviations else 0.0
    per_pos = {pos: sum(vals) / len(vals) for pos, vals in pos_deviations.items()}
    return overall, per_pos


def _keeper_stats(
    session: Session,
    keeper_candidates: list[KeeperCandidate],
    historical_pairs: list[tuple[int, uuid.UUID]],
) -> tuple[list[str], float]:
    """Return (positions sorted by frequency, avg keepers per season)."""
    if not keeper_candidates:
        return [], 0.0

    team_to_season: dict[uuid.UUID, int] = {tid: yr for yr, tid in historical_pairs}
    seasons_count: dict[int, int] = defaultdict(int)
    for kc in keeper_candidates:
        season = team_to_season.get(kc.team_id)
        if season is not None:
            seasons_count[season] += 1

    avg = sum(seasons_count.values()) / len(seasons_count) if seasons_count else 0.0

    # Fetch positions via player join
    player_ids = list({kc.player_id for kc in keeper_candidates})
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()  # type: ignore[attr-defined]
    pos_by_player: dict[uuid.UUID, str] = {p.id: _norm_pos(p.position) for p in players}
    pos_counts: Counter[str] = Counter(
        pos_by_player[kc.player_id]
        for kc in keeper_candidates
        if kc.player_id in pos_by_player
    )

    return [pos for pos, _ in pos_counts.most_common()], round(avg, 1)
