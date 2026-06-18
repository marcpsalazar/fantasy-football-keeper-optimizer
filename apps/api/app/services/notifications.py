from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import uuid

from sqlmodel import Session, select

from app.core.config import get_settings, Settings
from app.models import League, LeagueMembership, Team, User
from app.models.roster import FinalRosterEntry
from app.models.player import Player

logger = logging.getLogger(__name__)


class NotificationError(RuntimeError):
    """Raised when email delivery fails."""


def _smtp_configured() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_username and s.smtp_password)


# ---------------------------------------------------------------------------
# News helpers
# ---------------------------------------------------------------------------

def _score_news_for_players(news_items: list, player_names: list[str]) -> list[tuple[int, object]]:
    """Score each news item by how many player names appear in the headline."""
    scored = []
    for item in news_items:
        headline_lower = item.headline.casefold()
        score = sum(1 for name in player_names if name.casefold() in headline_lower)
        scored.append((score, item))
    return scored


def _select_news_for_team(
    all_news: list,
    player_names: list[str],
    count: int = 3,
) -> tuple[list, list[str]]:
    """Return top `count` news items and the matched player names for each."""
    scored = sorted(_score_news_for_players(all_news, player_names), key=lambda x: x[0], reverse=True)
    matched = [item for score, item in scored if score > 0]
    if matched:
        selected = matched[:count]
    else:
        selected = [item for _, item in scored[:count]]

    matched_players: list[str] = []
    for item in selected:
        headline_lower = item.headline.casefold()
        found = [name for name in player_names if name.casefold() in headline_lower]
        matched_players.append(found[0] if found else "")

    return selected, matched_players


# ---------------------------------------------------------------------------
# Email HTML builder
# ---------------------------------------------------------------------------

def _player_image_tag(image_url: str | None, player_name: str, size: int = 48) -> str:
    if not image_url:
        return (
            f'<div style="width:{size}px;height:{size}px;border-radius:50%;'
            f'background:#334155;display:inline-flex;align-items:center;'
            f'justify-content:center;font-size:18px;">🏈</div>'
        )
    return (
        f'<img src="{image_url}" alt="{player_name}" width="{size}" height="{size}" '
        f'style="border-radius:50%;object-fit:cover;background:#334155;" />'
    )


def _news_item_html(item, matched_player_name: str, player_image_url: str | None) -> str:
    img_tag = _player_image_tag(player_image_url, matched_player_name or "Player", size=44)
    source_badge = (
        f'<span style="font-size:11px;color:#94a3b8;background:#1e293b;'
        f'padding:2px 7px;border-radius:10px;margin-left:8px;">{item.source}</span>'
        if item.source else ""
    )
    return f"""
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="52" valign="top" style="padding-right:12px;">{img_tag}</td>
        <td valign="middle">
          <a href="{item.link}" style="color:#e2e8f0;text-decoration:none;font-size:14px;line-height:1.5;font-weight:500;">{item.headline}</a>
          <div style="margin-top:4px;">{source_badge}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>"""


def _strategy_bullet_html(bullet: str) -> str:
    return (
        f'<tr><td style="padding:5px 0 5px 8px;color:#cbd5e1;font-size:14px;line-height:1.5;">'
        f'<span style="color:#a78bfa;margin-right:8px;">▸</span>{bullet}</td></tr>'
    )


def _featured_player_html(player_name: str, position: str, nfl_team: str, image_url: str | None) -> str:
    img_tag = _player_image_tag(image_url, player_name, size=64)
    return f"""
<table cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;padding:16px;margin-top:16px;width:100%;">
  <tr>
    <td width="80" valign="middle" style="padding-right:16px;">{img_tag}</td>
    <td valign="middle">
      <div style="color:#f8fafc;font-size:16px;font-weight:700;">{player_name}</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:3px;">{position} &bull; {nfl_team}</div>
      <div style="margin-top:6px;">
        <span style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:11px;padding:3px 10px;border-radius:10px;font-weight:600;">Featured Player</span>
      </div>
    </td>
  </tr>
</table>"""


def _build_personalized_email(
    *,
    owner_name: str,
    team_name: str,
    league_name: str,
    season_year: int,
    deadline_str: str,
    draft_str: str,
    app_url: str,
    news_items: list,
    matched_player_names: list[str],
    player_image_map: dict[str, str | None],
    strategy_headline: str | None,
    strategy_bullets: list[str],
    featured_player_name: str | None,
    featured_player_position: str,
    featured_player_nfl_team: str,
    featured_player_image: str | None,
    league_id: uuid.UUID,
) -> tuple[str, str]:
    """Return (html_body, text_body) for one recipient."""

    # --- News section rows ---
    news_rows = ""
    for item, matched_name in zip(news_items, matched_player_names):
        img_url = player_image_map.get(matched_name) if matched_name else None
        news_rows += _news_item_html(item, matched_name, img_url)

    # --- Strategy section ---
    if strategy_headline:
        bullets_html = "".join(_strategy_bullet_html(b) for b in strategy_bullets)
        featured_html = ""
        if featured_player_name:
            featured_html = _featured_player_html(
                featured_player_name,
                featured_player_position,
                featured_player_nfl_team,
                featured_player_image,
            )
        strategy_section = f"""
          <!-- Strategy Section -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#0f172a;border-radius:10px;padding:24px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#a78bfa;text-transform:uppercase;margin-bottom:8px;">&#x1F9E0; Strategy for {team_name}</div>
                <div style="color:#f8fafc;font-size:17px;font-weight:700;line-height:1.4;margin-bottom:16px;">{strategy_headline}</div>
                <table cellpadding="0" cellspacing="0" width="100%">
                  {bullets_html}
                </table>
                {featured_html}
              </div>
            </td>
          </tr>"""
    else:
        strategy_section = ""

    # --- Opt-out note ---
    opt_out_url = f"{app_url}/profile#email-preferences"

    html_body = f"""
<html>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Mayhem Fantasy Football Tools</div>
                    <div style="color:#c4b5fd;font-size:13px;margin-top:4px;">mayhemfantasyfootballtools.com</div>
                  </td>
                  <td align="right" style="color:#e9d5ff;font-size:28px;">🏈</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="color:#f8fafc;font-size:22px;font-weight:700;">Hey {owner_name}! 👋</div>
              <div style="color:#94a3b8;font-size:14px;margin-top:4px;">{league_name} &bull; {season_year} Season</div>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:20px 40px 0;"><div style="border-top:1px solid #334155;"></div></td></tr>

          <!-- Section 1: Deadline -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#f87171;text-transform:uppercase;margin-bottom:12px;">&#x23F0; Keeper Deadline</div>
              <p style="margin:0 0 10px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Your keeper pick deadline for <strong style="color:#f8fafc;">{league_name}</strong> is coming up:
              </p>
              <div style="background-color:#0f172a;border-left:4px solid #f87171;border-radius:6px;padding:14px 18px;margin:14px 0;">
                <div style="color:#f87171;font-size:22px;font-weight:700;">{deadline_str}</div>
              </div>
              <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;">
                Draft date: <strong style="color:#f8fafc;">{draft_str}</strong>
              </p>
              <a href="{app_url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:14px;font-weight:600;">
                Finalize My Keepers &rarr;
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:24px 40px 0;"><div style="border-top:1px solid #334155;"></div></td></tr>

          <!-- Section 2: News -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#38bdf8;text-transform:uppercase;margin-bottom:16px;">&#x1F4F0; Your Players in the News</div>
              <table cellpadding="0" cellspacing="0" width="100%">
                {news_rows if news_rows else '<tr><td style="color:#64748b;font-size:14px;padding:8px 0;">No recent news found for your roster.</td></tr>'}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:24px 40px 0;"><div style="border-top:1px solid #334155;"></div></td></tr>

          {strategy_section}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 24px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0 0 6px;color:#64748b;font-size:12px;">
                Sent by your league commissioner via
                <a href="https://mayhemfantasyfootballtools.com" style="color:#7c3aed;text-decoration:none;">Mayhem Fantasy Football Tools</a>
              </p>
              <p style="margin:0;color:#475569;font-size:11px;">
                <a href="{opt_out_url}" style="color:#475569;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    text_body = (
        f"Hey {owner_name}!\n"
        f"{league_name} — {season_year} Season\n\n"
        f"KEEPER DEADLINE\n"
        f"Your keeper pick deadline is: {deadline_str}\n"
        f"Draft date: {draft_str}\n"
        f"Finalize your keepers: {app_url}\n\n"
    )
    if news_items:
        text_body += "YOUR PLAYERS IN THE NEWS\n"
        for item in news_items:
            text_body += f"• {item.headline}\n  {item.link}\n"
        text_body += "\n"
    if strategy_headline:
        text_body += f"STRATEGY FOR {team_name.upper()}\n{strategy_headline}\n"
        for b in strategy_bullets:
            text_body += f"• {b}\n"
        text_body += "\n"
    text_body += (
        f"Manage email preferences: {opt_out_url}\n"
        "Sent via Mayhem Fantasy Football Tools — https://mayhemfantasyfootballtools.com"
    )

    return html_body, text_body


# ---------------------------------------------------------------------------
# Main send function
# ---------------------------------------------------------------------------

def send_keeper_deadline_reminders(
    session: Session,
    league_id: uuid.UUID,
    *,
    dry_run: bool = False,
) -> list[str]:
    """Send personalized keeper deadline reminder emails to league members.

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
    if not memberships:
        return []

    user_ids = [m.user_id for m in memberships]
    users = session.exec(
        select(User).where(User.id.in_(user_ids), User.is_active == True)  # noqa: E712
    ).all()
    user_map = {u.id: u for u in users}
    membership_map = {m.user_id: m for m in memberships}

    deadline_str = league.keeper_pick_deadline.strftime("%A, %B %-d, %Y")
    draft_str = league.draft_date.strftime("%A, %B %-d, %Y") if league.draft_date else "TBD"
    app_url = settings.frontend_url

    # Pre-fetch all teams and rosters for the league in bulk
    all_teams = session.exec(
        select(Team).where(Team.league_id == league_id)
    ).all()
    team_by_user: dict[uuid.UUID, Team] = {t.user_id: t for t in all_teams if t.user_id}

    all_roster_entries = session.exec(
        select(FinalRosterEntry).where(
            FinalRosterEntry.league_id == league_id,
            FinalRosterEntry.season_year == league.season_year,
        )
    ).all()
    roster_by_team: dict[uuid.UUID, list[FinalRosterEntry]] = {}
    for entry in all_roster_entries:
        roster_by_team.setdefault(entry.team_id, []).append(entry)

    # Load all players referenced by roster entries
    player_ids = list({e.player_id for e in all_roster_entries if e.player_id})
    players_by_id: dict[uuid.UUID, Player] = {}
    if player_ids:
        fetched = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
        players_by_id = {p.id: p for p in fetched}

    # Fetch news once (cached globally)
    try:
        from app.services.news_feed import fetch_fantasy_news
        all_news = fetch_fantasy_news(settings, limit=24)
    except Exception:
        all_news = []

    # Build recipients list (respecting opt-out)
    recipients_data: list[tuple[str, User, Team | None, list[Player]]] = []
    for user in users:
        membership = membership_map.get(user.id)
        if membership and membership.email_opt_out:
            continue
        if not user.email:
            continue
        team = team_by_user.get(user.id)
        players: list[Player] = []
        if team:
            for entry in roster_by_team.get(team.id, []):
                if entry.player_id and entry.player_id in players_by_id:
                    players.append(players_by_id[entry.player_id])
        recipients_data.append((user.email, user, team, players))

    if not recipients_data:
        return []

    recipients = [email for email, *_ in recipients_data]
    if dry_run:
        return recipients

    errors: list[str] = []
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:  # type: ignore[arg-type]
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)  # type: ignore[arg-type]

            for email_addr, user, team, players in recipients_data:
                owner_name = _resolve_owner_name(user, team)
                team_name = team.name if team else league.name
                player_names = [p.full_name for p in players if p.full_name]
                player_image_map: dict[str, str | None] = {
                    p.full_name: p.image_url for p in players if p.full_name
                }

                # Select and match news items
                news_items, matched_player_names = _select_news_for_team(all_news, player_names, count=3)

                # Build AI strategy
                strategy_headline: str | None = None
                strategy_bullets: list[str] = []
                featured_player_name: str | None = None
                featured_player_position = ""
                featured_player_nfl_team = ""
                featured_player_image: str | None = None

                try:
                    from app.services import email_strategy_ai
                    if email_strategy_ai.is_enabled(settings):
                        news_for_ai = [
                            {"headline": item.headline, "source": item.source}
                            for item in news_items
                        ]
                        player_dicts = [
                            {
                                "name": p.full_name,
                                "position": p.position or "",
                                "nfl_team": p.nfl_team or "",
                                "injury_status": p.injury_status or "",
                            }
                            for p in players
                        ]
                        context = email_strategy_ai.build_strategy_context(
                            owner_name=owner_name,
                            team_name=team_name,
                            league_name=league.name,
                            season_year=league.season_year,
                            scoring_format=league.scoring_format,
                            keeper_pick_deadline=deadline_str,
                            draft_date=draft_str,
                            players=player_dicts,
                            news_items=news_for_ai,
                        )
                        result = email_strategy_ai.generate_email_strategy(
                            settings=settings,
                            context=context,
                        )
                        strategy_headline = result.strategy_headline
                        strategy_bullets = result.strategy_bullets
                        featured_player_name = result.featured_player
                        if featured_player_name:
                            fp = next((p for p in players if p.full_name == featured_player_name), None)
                            if fp:
                                featured_player_position = fp.position or ""
                                featured_player_nfl_team = fp.nfl_team or ""
                                featured_player_image = fp.image_url
                except Exception as exc:
                    logger.warning("Email strategy AI failed for %s: %s", email_addr, exc)

                html_body, text_body = _build_personalized_email(
                    owner_name=owner_name,
                    team_name=team_name,
                    league_name=league.name,
                    season_year=league.season_year,
                    deadline_str=deadline_str,
                    draft_str=draft_str,
                    app_url=app_url,
                    news_items=news_items,
                    matched_player_names=matched_player_names,
                    player_image_map=player_image_map,
                    strategy_headline=strategy_headline,
                    strategy_bullets=strategy_bullets,
                    featured_player_name=featured_player_name,
                    featured_player_position=featured_player_position,
                    featured_player_nfl_team=featured_player_nfl_team,
                    featured_player_image=featured_player_image,
                    league_id=league_id,
                )

                subject = f"[{league.name}] Keeper Pick Deadline — {deadline_str}"
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
                msg["To"] = email_addr
                msg.attach(MIMEText(text_body, "plain"))
                msg.attach(MIMEText(html_body, "html"))
                try:
                    server.sendmail(settings.smtp_from_email, [email_addr], msg.as_string())
                except (smtplib.SMTPException, OSError) as exc:
                    errors.append(f"{email_addr}: {exc}")

    except (smtplib.SMTPException, OSError) as exc:
        raise NotificationError(f"SMTP connection failed: {exc}") from exc

    if errors:
        raise NotificationError(f"Some emails failed to send: {'; '.join(errors)}")

    return recipients


def _resolve_owner_name(user: User, team: Team | None) -> str:
    if team and team.owner_name:
        return team.owner_name
    if user.alias:
        return user.alias
    return user.email.split("@")[0] if user.email else "Manager"


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
