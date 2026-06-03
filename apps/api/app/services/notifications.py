from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date
import uuid

from sqlmodel import Session, select

from app.core.config import get_settings
from app.models import League, LeagueMembership, Team, User


class NotificationError(RuntimeError):
    """Raised when email delivery fails."""


def _smtp_configured() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_username and s.smtp_password)


def send_keeper_deadline_reminders(
    session: Session,
    league_id: uuid.UUID,
    *,
    dry_run: bool = False,
) -> list[str]:
    """Send keeper deadline reminder emails to all league members with accounts.

    Returns a list of email addresses that were (or would be) sent to.
    Raises NotificationError if SMTP is not configured or delivery fails.
    """
    settings = get_settings()

    if not _smtp_configured() and not dry_run:
        raise NotificationError(
            "SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD "
            "environment variables to enable email reminders."
        )

    league = session.get(League, league_id)
    if league is None:
        raise NotificationError(f"League {league_id} was not found")

    if league.keeper_pick_deadline is None:
        raise NotificationError("This league has no keeper pick deadline set.")

    memberships = session.exec(
        select(LeagueMembership).where(LeagueMembership.league_id == league_id)
    ).all()
    user_ids = [m.user_id for m in memberships]
    if not user_ids:
        return []

    users = session.exec(select(User).where(User.id.in_(user_ids), User.is_active == True)).all()  # noqa: E712
    recipients = [u.email for u in users if u.email]
    if not recipients:
        return recipients

    if dry_run:
        return recipients

    subject = f"[{league.name}] Keeper Pick Deadline Reminder"
    deadline_str = league.keeper_pick_deadline.strftime("%A, %B %-d, %Y")
    draft_str = league.draft_date.strftime("%A, %B %-d, %Y") if league.draft_date else "TBD"

    html_body = f"""
<html><body style="font-family:sans-serif;color:#111827;">
<h2 style="color:#1d4ed8;">Keeper Deadline Reminder — {league.name}</h2>
<p>This is a reminder that the keeper pick deadline for the <strong>{league.name}</strong>
{league.season_year} season is:</p>
<p style="font-size:1.25rem;font-weight:bold;color:#dc2626;">{deadline_str}</p>
<p>Draft date: <strong>{draft_str}</strong></p>
<p>Log in to Keeper Optimizer to finalize your keeper selections before the deadline.</p>
<p style="color:#6b7280;font-size:0.875rem;">This reminder was sent by your league commissioner.</p>
</body></html>
"""
    text_body = (
        f"Keeper Deadline Reminder — {league.name}\n\n"
        f"The keeper pick deadline is: {deadline_str}\n"
        f"Draft date: {draft_str}\n\n"
        "Log in to Keeper Optimizer to finalize your keeper selections."
    )

    errors: list[str] = []
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:  # type: ignore[arg-type]
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)  # type: ignore[arg-type]
            for recipient in recipients:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
                msg["To"] = recipient
                msg.attach(MIMEText(text_body, "plain"))
                msg.attach(MIMEText(html_body, "html"))
                try:
                    server.sendmail(settings.smtp_from_email, [recipient], msg.as_string())
                except smtplib.SMTPException as exc:
                    errors.append(f"{recipient}: {exc}")
    except smtplib.SMTPException as exc:
        raise NotificationError(f"SMTP connection failed: {exc}") from exc

    if errors:
        raise NotificationError(f"Some emails failed to send: {'; '.join(errors)}")

    return recipients


def smtp_status() -> dict[str, bool | str]:
    """Return whether SMTP is configured (without credentials)."""
    s = get_settings()
    configured = _smtp_configured()
    return {
        "configured": configured,
        "host": s.smtp_host or "",
        "port": s.smtp_port,
        "from_email": s.smtp_from_email,
    }
