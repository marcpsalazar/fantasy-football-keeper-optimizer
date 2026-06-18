from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from sqlmodel import Session, select

from app.core.config import Settings
from app.db.session import engine
from app.models import League
from app.services.notifications import NotificationError, _smtp_configured, send_keeper_deadline_reminders

logger = logging.getLogger(__name__)

_SCHEDULE_THRESHOLDS: dict[str, timedelta] = {
    "daily": timedelta(hours=20),
    "weekly": timedelta(days=6),
    "monthly": timedelta(days=28),
}


async def email_reminder_loop(settings: Settings) -> None:
    """Hourly loop that auto-sends deadline reminder emails for leagues with a schedule set."""
    while True:
        await asyncio.sleep(3600)
        await asyncio.to_thread(_check_and_send_due_leagues, settings)


def _check_and_send_due_leagues(settings: Settings) -> None:
    if not _smtp_configured():
        return

    with Session(engine) as session:
        leagues = session.exec(
            select(League).where(
                League.email_enabled == True,  # noqa: E712
                League.email_schedule != "none",
            )
        ).all()

        for league in leagues:
            if not _is_league_due(league):
                continue
            try:
                recipients = send_keeper_deadline_reminders(session, league.id)
                league.email_last_sent = datetime.now(UTC).replace(tzinfo=None)
                session.add(league)
                session.commit()
                logger.info(
                    "Scheduled email sent for league %s (%s) to %d recipients",
                    league.name,
                    league.id,
                    len(recipients),
                )
            except NotificationError as exc:
                logger.warning("Scheduled email failed for league %s: %s", league.name, exc)
            except Exception as exc:
                logger.exception("Unexpected error sending scheduled email for league %s: %s", league.name, exc)


def _is_league_due(league: League) -> bool:
    # Must have a deadline in the future
    if league.keeper_pick_deadline is None or league.keeper_pick_deadline < date.today():
        return False

    threshold = _SCHEDULE_THRESHOLDS.get(league.email_schedule)
    if threshold is None:
        return False

    if league.email_last_sent is None:
        return True

    last_sent = league.email_last_sent
    if last_sent.tzinfo is None:
        last_sent = last_sent.replace(tzinfo=UTC)

    return datetime.now(UTC) - last_sent >= threshold
