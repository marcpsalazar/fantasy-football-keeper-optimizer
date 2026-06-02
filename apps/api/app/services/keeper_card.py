"""Keeper Report Card image generator.

Produces an 900x500 PNG card summarising a team's keeper recommendations —
grade, surplus rounds, best pick, keeper list. Designed for sharing in
league group chats.
"""

from __future__ import annotations

from io import BytesIO
import os
import uuid
from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.models import League, Player, Team
from app.services.optimizer import latest_recommendation_batch


# ---------------------------------------------------------------------------
# Card dimensions and palette
# ---------------------------------------------------------------------------

CARD_W, CARD_H = 900, 500

# Background layers
BG_DARK = (24, 24, 27)        # zinc-900
BG_PANEL = (39, 39, 42)       # zinc-800
BG_HEADER = (17, 17, 19)      # near-black

# Text
TEXT_WHITE = (250, 250, 250)  # zinc-50
TEXT_MUTED = (161, 161, 170)  # zinc-400
TEXT_DIM = (113, 113, 122)    # zinc-500

# Accent colours by position
POS_COLORS: dict[str, tuple[int, int, int]] = {
    "QB":  (239, 68,  68),   # red-500
    "RB":  (59,  130, 246),  # blue-500
    "WR":  (34,  197, 94),   # green-500
    "TE":  (249, 115, 22),   # orange-500
    "K":   (139, 92,  246),  # violet-500
    "DEF": (139, 92,  246),
}

# Grade colours
GRADE_COLORS: dict[str, tuple[int, int, int]] = {
    "A": (16,  185, 129),  # emerald-500
    "B": (59,  130, 246),  # blue-500
    "C": (245, 158, 11),   # amber-500
    "D": (239, 68,  68),   # red-500
}

DIVIDER = (63, 63, 70)  # zinc-700


# ---------------------------------------------------------------------------
# Font helpers
# ---------------------------------------------------------------------------

try:
    from PIL import Image, ImageDraw, ImageFont

    _FONT_CANDIDATES = [
        # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/Library/Fonts/Arial.ttf",
        # Ubuntu / Debian (Railway)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # Windows (local dev)
        "C:/Windows/Fonts/arial.ttf",
    ]
    _FONT_CANDIDATES_REGULAR = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]

    def _font(size: int, bold: bool = True) -> ImageFont.ImageFont:
        candidates = _FONT_CANDIDATES if bold else _FONT_CANDIDATES_REGULAR
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
        return ImageFont.load_default(size=size)

    PILLOW_AVAILABLE = True

except ImportError:
    PILLOW_AVAILABLE = False


# ---------------------------------------------------------------------------
# Data assembly
# ---------------------------------------------------------------------------

@dataclass
class _KeeperRow:
    player_name: str
    position: str
    keeper_value: float
    keeper_score: float


@dataclass
class _CardData:
    team_name: str
    owner_name: str
    league_name: str
    season_year: int
    grade: str
    total_surplus: float
    keepers: list[_KeeperRow] = field(default_factory=list)
    best_keeper: _KeeperRow | None = None
    verdict: str = ""


class KeeperCardError(ValueError):
    """Raised when card data cannot be assembled."""


def _grade(total_surplus: float) -> str:
    if total_surplus >= 10:
        return "A"
    if total_surplus >= 6:
        return "B"
    if total_surplus >= 2:
        return "C"
    return "D"


def _verdict(data: _CardData) -> str:
    n = len(data.keepers)
    surplus = data.total_surplus
    grade = data.grade

    if grade == "A":
        opener = "Excellent keeper strategy"
    elif grade == "B":
        opener = "Solid keeper strategy"
    elif grade == "C":
        opener = "Modest keeper advantage"
    else:
        opener = "Minimal keeper advantage"

    surplus_str = f"+{surplus:.1f}" if surplus >= 0 else f"{surplus:.1f}"
    keeper_word = "keeper" if n == 1 else "keepers"
    best_note = f" — {data.best_keeper.player_name} is the standout." if data.best_keeper else "."
    return f"{opener} — {n} {keeper_word}, {surplus_str} surplus rounds total{best_note}"


def build_card_data(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    *,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> _CardData:
    league = session.get(League, league_id)
    if league is None:
        raise KeeperCardError(f"League {league_id} not found")

    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise KeeperCardError(f"Team {team_id} not found in league {league_id}")

    all_recs = latest_recommendation_batch(
        session, league_id, user_id=user_id, scenario_name=scenario_name
    )
    recs = [r for r in all_recs if r.team_id == team_id and r.is_recommended]

    player_ids = {r.player_id for r in recs}
    players: dict[uuid.UUID, Player] = {}
    if player_ids:
        for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all():
            players[p.id] = p

    rows: list[_KeeperRow] = []
    for rec in sorted(recs, key=lambda r: -(r.keeper_score or 0)):
        player = players.get(rec.player_id)
        rows.append(
            _KeeperRow(
                player_name=player.full_name if player else "Unknown",
                position=player.position if player else "—",
                keeper_value=rec.keeper_value or 0.0,
                keeper_score=rec.keeper_score or 0.0,
            )
        )

    total_surplus = sum(r.keeper_value for r in rows)
    grade = _grade(total_surplus)
    best = rows[0] if rows else None

    data = _CardData(
        team_name=team.name,
        owner_name=team.owner_name or "",
        league_name=league.name,
        season_year=league.season_year,
        grade=grade,
        total_surplus=total_surplus,
        keepers=rows,
        best_keeper=best,
    )
    data.verdict = _verdict(data)
    return data


# ---------------------------------------------------------------------------
# Image rendering
# ---------------------------------------------------------------------------

def render_card(data: _CardData) -> bytes:
    if not PILLOW_AVAILABLE:
        raise KeeperCardError("Pillow is not installed; cannot render keeper card image.")

    img = Image.new("RGB", (CARD_W, CARD_H), BG_DARK)
    draw = ImageDraw.Draw(img)

    _draw_header(draw, data)
    _draw_left_panel(draw, data)
    _draw_right_panel(draw, data)
    _draw_verdict_bar(draw, data)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# Header strip ──────────────────────────────────────────────────────────────

def _draw_header(draw: ImageDraw.ImageDraw, data: _CardData) -> None:
    HEADER_H = 56
    draw.rectangle([(0, 0), (CARD_W, HEADER_H)], fill=BG_HEADER)
    draw.rectangle([(0, HEADER_H), (CARD_W, HEADER_H + 1)], fill=DIVIDER)

    # League name (left)
    league_font = _font(17, bold=True)
    draw.text((24, 18), data.league_name, font=league_font, fill=TEXT_WHITE)

    # Season year (right)
    year_text = str(data.season_year)
    year_font = _font(17)
    bbox = draw.textbbox((0, 0), year_text, font=year_font)
    year_w = bbox[2] - bbox[0]
    draw.text((CARD_W - year_w - 24, 18), year_text, font=year_font, fill=TEXT_MUTED)

    # Branding badge (centred in header)
    brand_font = _font(13, bold=False)
    brand_text = "Keeper Optimizer"
    bbbox = draw.textbbox((0, 0), brand_text, font=brand_font)
    brand_w = bbbox[2] - bbbox[0]
    draw.text(((CARD_W - brand_w) // 2, 20), brand_text, font=brand_font, fill=TEXT_DIM)


# Left panel (team + keepers) ───────────────────────────────────────────────

LEFT_X = 24
CONTENT_TOP = 72  # below header
DIVIDER_X = 575   # vertical divider between panels


def _draw_left_panel(draw: ImageDraw.ImageDraw, data: _CardData) -> None:
    y = CONTENT_TOP + 8

    # Team name
    team_font = _font(28, bold=True)
    draw.text((LEFT_X, y), data.team_name, font=team_font, fill=TEXT_WHITE)
    y += 36

    # Owner name
    if data.owner_name:
        owner_font = _font(15, bold=False)
        draw.text((LEFT_X, y), f"Owner: {data.owner_name}", font=owner_font, fill=TEXT_MUTED)
        y += 24

    y += 12
    # Thin horizontal rule
    draw.rectangle([(LEFT_X, y), (DIVIDER_X - 24, y + 1)], fill=DIVIDER)
    y += 14

    # Section label
    label_font = _font(11, bold=True)
    draw.text((LEFT_X, y), "RECOMMENDED KEEPERS", font=label_font, fill=TEXT_DIM)
    y += 20

    if not data.keepers:
        no_font = _font(13, bold=False)
        draw.text((LEFT_X, y), "No keepers recommended.", font=no_font, fill=TEXT_MUTED)
        return

    row_font = _font(14, bold=True)
    sub_font = _font(13, bold=False)

    for keeper in data.keepers[:5]:
        if y > 390:
            break

        pos = keeper.position
        pos_color = POS_COLORS.get(pos, TEXT_MUTED)

        # Position pill background
        pill_w, pill_h = 36, 20
        draw.rounded_rectangle(
            [(LEFT_X, y), (LEFT_X + pill_w, y + pill_h)],
            radius=4,
            fill=pos_color,
        )
        pos_font = _font(11, bold=True)
        pb = draw.textbbox((0, 0), pos, font=pos_font)
        pw = pb[2] - pb[0]
        draw.text((LEFT_X + (pill_w - pw) // 2, y + 3), pos, font=pos_font, fill=TEXT_WHITE)

        # Player name
        name_x = LEFT_X + pill_w + 10
        draw.text((name_x, y + 1), keeper.player_name, font=row_font, fill=TEXT_WHITE)

        # Surplus rounds (right-aligned within left panel)
        surplus_str = (
            f"+{keeper.keeper_value:.1f} rds" if keeper.keeper_value >= 0
            else f"{keeper.keeper_value:.1f} rds"
        )
        surplus_color = (34, 197, 94) if keeper.keeper_value >= 0 else (239, 68, 68)
        sb = draw.textbbox((0, 0), surplus_str, font=sub_font)
        sw = sb[2] - sb[0]
        draw.text((DIVIDER_X - 24 - sw, y + 3), surplus_str, font=sub_font, fill=surplus_color)

        y += 30

    # Stats row below keeper list
    y = max(y + 4, 340)
    draw.rectangle([(LEFT_X, y), (DIVIDER_X - 24, y + 1)], fill=DIVIDER)
    y += 12

    stats_font = _font(13, bold=False)
    n = len(data.keepers)
    draw.text(
        (LEFT_X, y),
        f"{n} keeper{'s' if n != 1 else ''}   "
        f"{'+'}{data.total_surplus:.1f} surplus rds" if data.total_surplus >= 0
        else f"{n} keeper{'s' if n != 1 else ''}   {data.total_surplus:.1f} surplus rds",
        font=stats_font,
        fill=TEXT_MUTED,
    )


def _stats_line(n: int, total: float) -> str:
    sign = "+" if total >= 0 else ""
    plural = "s" if n != 1 else ""
    return f"{n} keeper{plural}   {sign}{total:.1f} surplus rds"


# Right panel (grade) ───────────────────────────────────────────────────────

RIGHT_X = DIVIDER_X + 16
RIGHT_W = CARD_W - DIVIDER_X - 16


def _draw_right_panel(draw: ImageDraw.ImageDraw, data: _CardData) -> None:
    # Vertical divider line
    draw.rectangle([(DIVIDER_X, 57), (DIVIDER_X + 1, CARD_H - 52)], fill=DIVIDER)

    grade_color = GRADE_COLORS.get(data.grade, TEXT_MUTED)
    panel_cx = DIVIDER_X + (CARD_W - DIVIDER_X) // 2

    # Grade circle backdrop
    circle_r = 72
    cx, cy = panel_cx, 185
    draw.ellipse(
        [(cx - circle_r, cy - circle_r), (cx + circle_r, cy + circle_r)],
        fill=BG_PANEL,
        outline=grade_color,
        width=3,
    )

    # Grade letter
    grade_font = _font(80, bold=True)
    gb = draw.textbbox((0, 0), data.grade, font=grade_font)
    gw, gh = gb[2] - gb[0], gb[3] - gb[1]
    draw.text((cx - gw // 2, cy - gh // 2 - 4), data.grade, font=grade_font, fill=grade_color)

    # "KEEPER GRADE" label
    lbl_font = _font(11, bold=True)
    lbl = "KEEPER GRADE"
    lb = draw.textbbox((0, 0), lbl, font=lbl_font)
    lw = lb[2] - lb[0]
    draw.text((cx - lw // 2, cy + circle_r + 10), lbl, font=lbl_font, fill=TEXT_DIM)

    # Surplus stat
    stat_y = cy + circle_r + 36
    surplus_font = _font(22, bold=True)
    surplus_color = (34, 197, 94) if data.total_surplus >= 0 else (239, 68, 68)
    surplus_str = f"+{data.total_surplus:.1f}" if data.total_surplus >= 0 else f"{data.total_surplus:.1f}"
    sb = draw.textbbox((0, 0), surplus_str, font=surplus_font)
    sw = sb[2] - sb[0]
    draw.text((cx - sw // 2, stat_y), surplus_str, font=surplus_font, fill=surplus_color)

    unit_font = _font(12, bold=False)
    unit = "surplus rounds"
    ub = draw.textbbox((0, 0), unit, font=unit_font)
    uw = ub[2] - ub[0]
    draw.text((cx - uw // 2, stat_y + 28), unit, font=unit_font, fill=TEXT_MUTED)

    # Best keeper label
    if data.best_keeper:
        best_y = stat_y + 56
        best_font = _font(12, bold=False)
        best_label = "Best pick"
        bl = draw.textbbox((0, 0), best_label, font=best_font)
        blw = bl[2] - bl[0]
        draw.text((cx - blw // 2, best_y), best_label, font=best_font, fill=TEXT_DIM)

        best_name_font = _font(13, bold=True)
        best_pos = data.best_keeper.position
        best_name = f"{data.best_keeper.player_name} ({best_pos})"
        bnb = draw.textbbox((0, 0), best_name, font=best_name_font)
        bnw = bnb[2] - bnb[0]
        # Truncate if wider than right panel
        max_w = CARD_W - DIVIDER_X - 32
        if bnw > max_w:
            best_name = data.best_keeper.player_name[:18] + "…"
            bnb = draw.textbbox((0, 0), best_name, font=best_name_font)
            bnw = bnb[2] - bnb[0]
        pos_color = POS_COLORS.get(best_pos, TEXT_MUTED)
        draw.text((cx - bnw // 2, best_y + 18), best_name, font=best_name_font, fill=pos_color)


# Verdict bar ───────────────────────────────────────────────────────────────

VERDICT_Y = CARD_H - 52


def _draw_verdict_bar(draw: ImageDraw.ImageDraw, data: _CardData) -> None:
    draw.rectangle([(0, VERDICT_Y), (CARD_W, VERDICT_Y + 1)], fill=DIVIDER)
    draw.rectangle([(0, VERDICT_Y + 1), (CARD_W, CARD_H)], fill=BG_PANEL)

    verdict_font = _font(13, bold=False)
    # Clamp text width to card
    verdict = data.verdict
    vb = draw.textbbox((0, 0), verdict, font=verdict_font)
    vw = vb[2] - vb[0]
    if vw > CARD_W - 48:
        # Trim to fit
        while vw > CARD_W - 48 and len(verdict) > 10:
            verdict = verdict[:-2]
            vb = draw.textbbox((0, 0), verdict + "…", font=verdict_font)
            vw = vb[2] - vb[0]
        verdict += "…"

    draw.text((24, VERDICT_Y + 16), verdict, font=verdict_font, fill=TEXT_MUTED)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_keeper_card(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    *,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> bytes:
    data = build_card_data(session, league_id, team_id, scenario_name=scenario_name, user_id=user_id)
    return render_card(data)
