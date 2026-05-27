from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.core.config import Settings
from app.db.session import engine
from app.models import ADPSnapshot, League
from app.services.adp_refresh import ADPRefreshError, refresh_adp_from_api
from app.services.adp_review import create_ai_adp_refresh_candidate
from app.services.ai_adp import AIADPError


async def weekly_adp_refresh_loop(settings: Settings) -> None:
    if not settings.adp_auto_refresh_enabled:
        return
    if settings.adp_auto_refresh_on_startup:
        await asyncio.to_thread(refresh_due_adp_snapshots, settings)

    interval_seconds = max(1, settings.adp_auto_refresh_interval_hours) * 60 * 60
    while True:
        await asyncio.sleep(interval_seconds)
        await asyncio.to_thread(refresh_due_adp_snapshots, settings)


def refresh_due_adp_snapshots(settings: Settings) -> list[dict[str, object]]:
    refreshed: list[dict[str, object]] = []
    threshold = datetime.now(UTC) - timedelta(hours=max(1, settings.adp_auto_refresh_interval_hours))
    with Session(engine) as session:
        leagues = session.exec(select(League).order_by(League.name)).all()
        for league in leagues:
            latest = session.exec(
                select(ADPSnapshot)
                .where(ADPSnapshot.league_id == league.id)
                .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
            ).first()
            latest_created = _as_aware(latest.created_at) if latest else None
            if latest_created is not None and latest_created > threshold:
                continue
            try:
                if _should_create_review_candidate(settings):
                    candidate = create_ai_adp_refresh_candidate(session, league, settings)
                    refreshed.append(
                        {
                            "league_id": str(league.id),
                            "league_name": league.name,
                            "status": "pending_review",
                            "candidate_id": str(candidate.id),
                            "provider": candidate.provider,
                            "generated": len(candidate.normalized_rows),
                        }
                    )
                    continue
                result = refresh_adp_from_api(session, league.id, settings)
            except (ADPRefreshError, AIADPError) as exc:
                session.rollback()
                refreshed.append(
                    {
                        "league_id": str(league.id),
                        "league_name": league.name,
                        "status": "failed",
                        "error": str(exc),
                    }
                )
                continue
            refreshed.append(
                {
                    "league_id": str(league.id),
                    "league_name": league.name,
                    "status": "refreshed",
                    "provider": result.provider,
                    "imported": result.import_result.imported,
                }
            )
    return refreshed


def _should_create_review_candidate(settings: Settings) -> bool:
    provider = (settings.adp_provider or "").strip().lower()
    return settings.adp_ai_review_required and provider in {"ai_synthesized", "ai", "openai"}


def _as_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
