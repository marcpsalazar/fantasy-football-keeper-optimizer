from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlmodel import Session, select

from app.core.config import get_settings
from app.models import KeeperRecommendation, League, OptimizerSettings, Player, Team
from app.services.news_feed import NewsFeedError, fetch_fantasy_news
from app.services.optimizer import latest_recommendation_batch


@dataclass
class NewsAlert:
    player_id: str
    player_name: str
    position: str
    nfl_team: str | None
    team_name: str
    is_recommended: bool
    current_keeper_value: float | None
    current_adp_round: float | None
    keeper_cost_round: float | None
    # ADP round at which recommendation eligibility would flip
    flip_adp_round: float | None
    headline: str
    headline_link: str
    published_at: str


def get_news_alerts(
    session: Session,
    league_id: uuid.UUID,
    *,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> list[NewsAlert]:
    """Match current news headlines against active keeper candidates.

    Returns one alert per (player, headline) pair. A player appears in an
    alert when their name is found in a recent fantasy-relevant headline.
    flip_adp_round shows the ADP round at which the player's recommendation
    eligibility would change (keeper_value crosses minimum_keeper_value).
    """
    league = session.get(League, league_id)
    if league is None:
        return []

    recommendations = latest_recommendation_batch(
        session, league_id, user_id=user_id, scenario_name=scenario_name
    )
    # Only candidates that have ADP data (were scoreable by the optimizer)
    scoreable = [r for r in recommendations if r.adp_round is not None]
    if not scoreable:
        return []

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_count = max(len(teams), 1)
    team_by_id = {t.id: t for t in teams}

    minimum_keeper_value = _get_minimum_keeper_value(session, scoreable[0].settings_id)

    player_ids = {r.player_id for r in scoreable}
    players: dict[uuid.UUID, Player] = {
        p.id: p
        for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }

    try:
        headlines = fetch_fantasy_news(get_settings(), limit=20)
    except NewsFeedError:
        return []

    alerts: list[NewsAlert] = []
    seen: set[tuple[uuid.UUID, str]] = set()

    for rec in scoreable:
        player = players.get(rec.player_id)
        if player is None:
            continue
        for item in headlines:
            key = (rec.player_id, item.headline)
            if key in seen:
                continue
            if not _headline_matches_player(item.headline, player):
                continue
            seen.add(key)
            team = team_by_id.get(rec.team_id)
            alerts.append(
                NewsAlert(
                    player_id=str(rec.player_id),
                    player_name=player.full_name,
                    position=player.position,
                    nfl_team=player.nfl_team,
                    team_name=team.name if team else "Unknown",
                    is_recommended=bool(rec.is_recommended),
                    current_keeper_value=rec.keeper_value,
                    current_adp_round=rec.adp_round,
                    keeper_cost_round=rec.keeper_cost_round,
                    flip_adp_round=_compute_flip_round(rec, minimum_keeper_value, team_count),
                    headline=item.headline,
                    headline_link=item.link,
                    published_at=item.published_at,
                )
            )

    # Recommended players first, then by magnitude of keeper value
    alerts.sort(
        key=lambda a: (
            not a.is_recommended,
            -(abs(a.current_keeper_value) if a.current_keeper_value is not None else 0),
        )
    )
    return alerts


def _get_minimum_keeper_value(session: Session, settings_id: uuid.UUID | None) -> float:
    if settings_id is None:
        return 1.0
    settings = session.get(OptimizerSettings, settings_id)
    return settings.minimum_keeper_value if settings else 1.0


def _compute_flip_round(
    rec: KeeperRecommendation,
    minimum_keeper_value: float,
    team_count: int,
) -> float | None:
    """ADP round at which keeper_value crosses minimum_keeper_value.

    keeper_value = keeper_cost_pick - adp_pick
    Eligibility flips when keeper_value = minimum_keeper_value
    => adp_pick = keeper_cost_pick - minimum_keeper_value
    => adp_round ≈ keeper_cost_round - minimum_keeper_value / team_count
    """
    if rec.keeper_cost_round is None:
        return None
    flip = rec.keeper_cost_round - minimum_keeper_value / team_count
    return round(max(flip, 1.0), 1)


def _headline_matches_player(headline: str, player: Player) -> bool:
    """Return True if the headline likely refers to this player by name."""
    text = headline.casefold()
    name = player.full_name.casefold()

    # Full name as whole words
    if re.search(r"\b" + re.escape(name) + r"\b", text):
        return True

    # First word + last word of name, both as whole words
    # (handles "Patrick Mahomes" matching "Mahomes, Patrick" or middle-name variants)
    parts = name.split()
    if len(parts) >= 2:
        first = re.escape(parts[0])
        last = re.escape(parts[-1])
        if re.search(r"\b" + first + r"\b", text) and re.search(r"\b" + last + r"\b", text):
            return True

    return False
