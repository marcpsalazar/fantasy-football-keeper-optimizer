from __future__ import annotations

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import urllib.error
import urllib.request
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
        initial = player_name[0].upper() if player_name else "#"
        font_size = max(12, size // 2)
        return (
            f'<div style="width:{size}px;height:{size}px;border-radius:4px;background:#1a2236;'
            f'border:1px solid #2d3f5a;text-align:center;line-height:{size}px;'
            f'font-size:{font_size}px;font-weight:700;color:#4a6080;'
            f'font-family:Arial,sans-serif;display:inline-block;">{initial}</div>'
        )
    return (
        f'<img src="{image_url}" alt="{player_name}" width="{size}" height="{size}" '
        f'style="border-radius:4px;object-fit:cover;background:#1a2236;display:block;" />'
    )


def _section_label_html(text: str, color: str = "#94a3b8") -> str:
    return (
        f'<table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">'
        f'<tr>'
        f'<td width="3" style="background:#f59e0b;font-size:0;line-height:0;">&nbsp;</td>'
        f'<td style="padding-left:10px;font-size:10px;font-weight:800;letter-spacing:2.5px;'
        f'color:{color};text-transform:uppercase;font-family:Arial,sans-serif;">{text}</td>'
        f'</tr></table>'
    )


def _news_item_html(item, matched_player_name: str, player_image_url: str | None) -> str:
    img_tag = _player_image_tag(player_image_url, matched_player_name or "#", size=44)
    source_tag = (
        f'<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#4a6080;'
        f'text-transform:uppercase;">{item.source}</span>'
        if item.source else ""
    )
    return f"""
<tr>
  <td style="padding:12px 0;border-bottom:1px solid #1a2236;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="52" valign="top" style="padding-right:14px;">{img_tag}</td>
        <td valign="middle">
          <a href="{item.link}" style="color:#e2e8f0;text-decoration:none;font-size:14px;line-height:1.5;font-weight:600;font-family:Arial,sans-serif;">{item.headline}</a>
          <div style="margin-top:5px;">{source_tag}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>"""


def _strategy_bullet_html(bullet: str) -> str:
    return (
        f'<tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;line-height:1.6;'
        f'font-family:Arial,sans-serif;border-bottom:1px solid #1a2236;">'
        f'<span style="color:#f59e0b;margin-right:10px;font-weight:700;">—</span>{bullet}</td></tr>'
    )


def _featured_player_html(player_name: str, position: str, nfl_team: str, image_url: str | None) -> str:
    img_tag = _player_image_tag(image_url, player_name, size=80)
    pos_abbr = (position[:2] if position else "?").upper()
    return f"""
<table cellpadding="0" cellspacing="0" style="margin-top:24px;width:100%;background:#080c14;border:1px solid #f59e0b;">
  <!-- Gold top stripe -->
  <tr><td colspan="4" style="background:#f59e0b;height:2px;font-size:0;">&nbsp;</td></tr>
  <tr>
    <!-- Gold left accent -->
    <td width="4" style="background:#f59e0b;font-size:0;">&nbsp;</td>
    <!-- Player photo -->
    <td width="100" valign="middle" style="padding:16px 12px 16px 16px;">{img_tag}</td>
    <!-- Player info -->
    <td valign="middle" style="padding:16px 8px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:2.5px;color:#f59e0b;text-transform:uppercase;margin-bottom:6px;font-family:Arial,sans-serif;">Key Player</div>
      <div style="font-size:18px;font-weight:900;color:#ffffff;letter-spacing:0.5px;font-family:Arial,sans-serif;">{player_name}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#4a6080;text-transform:uppercase;margin-top:5px;font-family:Arial,sans-serif;">{nfl_team}</div>
    </td>
    <!-- Position badge -->
    <td width="64" valign="middle" style="padding:16px;" align="center">
      <div style="background:#f59e0b;color:#080c14;font-size:15px;font-weight:900;width:46px;height:46px;line-height:46px;text-align:center;font-family:Arial,sans-serif;margin:0 auto;">{pos_abbr}</div>
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
    deadline_short: str,
    deadline_year: str,
    days_remaining: int,
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
            <td style="padding:24px 40px 32px;background:#111827;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#0d1117;border-top:3px solid #f59e0b;border-left:3px solid #f59e0b;">
                <tr>
                  <td style="padding:24px;">
                    {_section_label_html(f"Strategy &mdash; {team_name}")}
                    <div style="color:#f8fafc;font-size:19px;font-weight:900;line-height:1.4;margin-bottom:20px;font-family:Arial,sans-serif;">{strategy_headline}</div>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      {bullets_html}
                    </table>
                    {featured_html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""
    else:
        strategy_section = ""

    # --- Opt-out note ---
    opt_out_url = f"{app_url}/profile#email-preferences"

    days_label = "DAY" if days_remaining == 1 else "DAYS"

    html_body = f"""
<html>
<head></head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111827;max-width:600px;">

          <!-- Gold top bar -->
          <tr><td style="background:#f59e0b;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Hero SVG served from our own domain — always loads, no external CDN needed -->
          <tr>
            <td style="padding:0;background:#080c14;font-size:0;line-height:0;">
              <img src="https://mayhemfantasyfootballtools.com/email/hero.svg?v=3"
                   width="600" height="200" alt=""
                   style="display:block;width:100%;max-width:600px;height:auto;" />
            </td>
          </tr>

          <!-- Branding bar below image -->
          <tr>
            <td style="background:#0d1117;padding:22px 40px 26px;border-top:2px solid #1a2236;">
              <div style="font-size:10px;font-weight:800;letter-spacing:3px;color:#f59e0b;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">Fantasy Football</div>
              <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:2px;font-family:Arial,sans-serif;">MAYHEM</div>
              <div style="font-size:11px;color:#4a6080;letter-spacing:1px;margin-top:6px;font-family:Arial,sans-serif;">mayhemfantasyfootballtools.com</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="background:#111827;padding:32px 40px 0;">
              <div style="font-size:28px;font-weight:900;color:#f8fafc;letter-spacing:0.5px;font-family:Arial,sans-serif;">HEY, {owner_name.upper()}.</div>
              <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:#4a6080;text-transform:uppercase;margin-top:8px;font-family:Arial,sans-serif;">{league_name} &bull; {season_year} Season</div>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#111827;padding:24px 40px 0;"><div style="border-top:1px solid #1a2236;">&nbsp;</div></td></tr>

          <!-- Section 1: Scoreboard Deadline -->
          <tr>
            <td style="background:#111827;padding:24px 40px 28px;">
              {_section_label_html("Keeper Deadline")}
              <!-- Scoreboard -->
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#0d1117;border:1px solid #1a2236;">
                <tr><td colspan="5" style="background:#f59e0b;height:2px;font-size:0;">&nbsp;</td></tr>
                <tr>
                  <!-- Date -->
                  <td style="padding:18px 0;text-align:center;border-right:1px solid #1a2236;width:33%;">
                    <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#4a6080;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">Deadline</div>
                    <div style="font-size:24px;font-weight:900;color:#ffffff;font-family:'Courier New',Courier,monospace;letter-spacing:1px;">{deadline_short}</div>
                    <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-top:4px;font-family:Arial,sans-serif;">{deadline_year}</div>
                  </td>
                  <!-- League -->
                  <td style="padding:18px 12px;text-align:center;border-right:1px solid #1a2236;width:33%;">
                    <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#4a6080;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">League</div>
                    <div style="font-size:13px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;line-height:1.3;">{league_name}</div>
                  </td>
                  <!-- Countdown -->
                  <td style="padding:18px 0;text-align:center;width:33%;">
                    <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#4a6080;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">Time Left</div>
                    <div style="font-size:30px;font-weight:900;color:#f59e0b;font-family:'Courier New',Courier,monospace;">{days_remaining}</div>
                    <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#4a6080;text-transform:uppercase;margin-top:2px;font-family:Arial,sans-serif;">{days_label}</div>
                  </td>
                </tr>
                <tr><td colspan="5" style="background:#f59e0b;height:2px;font-size:0;">&nbsp;</td></tr>
              </table>
              <!-- Draft date + CTA -->
              <p style="margin:16px 0 20px;color:#4a6080;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">
                Draft &rarr; <span style="color:#94a3b8;">{draft_str}</span>
              </p>
              <a href="{app_url}" style="display:inline-block;background:#f59e0b;color:#080c14;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">
                Finalize My Keepers &rarr;
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#111827;padding:0 40px;"><div style="border-top:1px solid #1a2236;">&nbsp;</div></td></tr>

          <!-- Section 2: News -->
          <tr>
            <td style="background:#111827;padding:24px 40px 28px;">
              {_section_label_html("Players in the News")}
              <table cellpadding="0" cellspacing="0" width="100%">
                {news_rows if news_rows else '<tr><td style="color:#4a6080;font-size:13px;padding:8px 0;font-family:Arial,sans-serif;">No recent news for your roster.</td></tr>'}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#111827;padding:0 40px;"><div style="border-top:1px solid #1a2236;">&nbsp;</div></td></tr>

          {strategy_section}

          <!-- Footer -->
          <tr>
            <td style="background:#0d1117;padding:20px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #f59e0b;">
                <tr><td style="height:16px;">&nbsp;</td></tr>
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 6px;color:#2d3f5a;font-size:11px;font-family:Arial,sans-serif;">
                      Sent by your league commissioner &bull;
                      <a href="https://mayhemfantasyfootballtools.com" style="color:#4a6080;text-decoration:none;">Mayhem Fantasy Football Tools</a>
                    </p>
                    <a href="{opt_out_url}" style="color:#2d3f5a;font-size:10px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;font-family:Arial,sans-serif;">Manage Email Preferences</a>
                  </td>
                </tr>
              </table>
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

    from datetime import date as _date
    deadline_str = league.keeper_pick_deadline.strftime("%A, %B %-d, %Y")
    deadline_short = league.keeper_pick_deadline.strftime("%b %-d").upper()
    deadline_year = str(league.keeper_pick_deadline.year)
    days_remaining = max(0, (league.keeper_pick_deadline - _date.today()).days)
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

    use_resend_api = (settings.smtp_host or "").lower() == "smtp.resend.com"
    from_display = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"

    # For SMTP mode: open one persistent connection for all recipients.
    smtp_server: smtplib.SMTP | None = None
    if not use_resend_api:
        try:
            smtp_server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)  # type: ignore[arg-type]
            if settings.smtp_use_tls:
                smtp_server.starttls()
            smtp_server.login(settings.smtp_username, settings.smtp_password)  # type: ignore[arg-type]
        except (smtplib.SMTPException, OSError) as exc:
            raise NotificationError(f"SMTP connection failed: {exc}") from exc

    errors: list[str] = []
    try:
        for email_addr, user, team, players in recipients_data:
            owner_name = _resolve_owner_name(user, team)
            team_name = team.name if team else league.name
            player_names = [p.full_name for p in players if p.full_name]
            player_image_map: dict[str, str | None] = {
                p.full_name: p.image_url for p in players if p.full_name
            }

            news_items, matched_player_names = _select_news_for_team(all_news, player_names, count=3)

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
                deadline_short=deadline_short,
                deadline_year=deadline_year,
                days_remaining=days_remaining,
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

            try:
                if use_resend_api:
                    _send_via_resend_api(
                        api_key=settings.smtp_password,  # type: ignore[arg-type]
                        from_display=from_display,
                        to=email_addr,
                        subject=subject,
                        html=html_body,
                        text=text_body,
                    )
                else:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = from_display
                    msg["To"] = email_addr
                    msg.attach(MIMEText(text_body, "plain"))
                    msg.attach(MIMEText(html_body, "html"))
                    smtp_server.sendmail(settings.smtp_from_email, [email_addr], msg.as_string())  # type: ignore[union-attr]
            except (NotificationError, smtplib.SMTPException, OSError) as exc:
                errors.append(f"{email_addr}: {exc}")
    finally:
        if smtp_server is not None:
            try:
                smtp_server.quit()
            except Exception:
                pass

    if errors:
        raise NotificationError(f"Some emails failed to send: {'; '.join(errors)}")

    return recipients


def _send_via_resend_api(
    *,
    api_key: str,
    from_display: str,
    to: str,
    subject: str,
    html: str,
    text: str,
) -> None:
    """Send one email via Resend's HTTPS API (port 443 — works on Railway)."""
    payload = json.dumps({
        "from": from_display,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "keeper-optimizer/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status not in (200, 201):
                raise NotificationError(f"Resend API returned {resp.status}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise NotificationError(f"Resend API error {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise NotificationError(f"Resend API request failed: {exc}") from exc


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
