from __future__ import annotations

from collections import defaultdict
from io import BytesIO
import uuid

from sqlmodel import Session, select

from app.models import KeeperRecommendation, League, Player, Team
from app.services.optimizer import latest_recommendation_batch


class PDFExportError(ValueError):
    """Raised when a team outlook PDF cannot be built."""


def build_team_outlooks_pdf(
    session: Session,
    league_id: uuid.UUID,
    *,
    team_id: uuid.UUID | None = None,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> bytes:
    league = session.get(League, league_id)
    if league is None:
        raise PDFExportError(f"League {league_id} was not found")

    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    if team_id is not None:
        teams = [team for team in teams if team.id == team_id]
        if not teams:
            raise PDFExportError(f"Team {team_id} was not found")

    recommendations = _load_recommendations(session, league.id, scenario_name, user_id)
    players = _players_by_id(session, {recommendation.player_id for recommendation in recommendations})
    recommendations_by_team: dict[uuid.UUID, list[KeeperRecommendation]] = defaultdict(list)
    for recommendation in recommendations:
        recommendations_by_team[recommendation.team_id].append(recommendation)

    pages = [_league_summary_lines(league, teams, recommendations)]
    for team in sorted(teams, key=lambda row: (row.draft_slot or 99, row.name)):
        pages.append(
            _team_outlook_lines(
                team=team,
                recommendations=recommendations_by_team.get(team.id, []),
                players=players,
            )
        )

    return _build_pdf(pages)


def _load_recommendations(
    session: Session,
    league_id: uuid.UUID,
    scenario_name: str | None,
    user_id: uuid.UUID | None,
) -> list[KeeperRecommendation]:
    return latest_recommendation_batch(session, league_id, user_id=user_id, scenario_name=scenario_name)


def _players_by_id(session: Session, player_ids: set[uuid.UUID]) -> dict[uuid.UUID, Player]:
    if not player_ids:
        return {}
    return {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }


def _league_summary_lines(
    league: League,
    teams: list[Team],
    recommendations: list[KeeperRecommendation],
) -> list[str]:
    selected = [row for row in recommendations if row.is_recommended]
    return [
        f"{league.name} Keeper Outlook",
        f"Season: {league.season_year}",
        f"Format: {league.scoring_format} / {league.draft_type}",
        f"Teams: {len(teams)}",
        f"Projected keepers: {len(selected)}",
        f"Total keeper score: {sum(row.keeper_score or 0 for row in selected):.1f}",
        f"Total keeper value: {sum(row.keeper_value or 0 for row in selected):.1f}",
    ]


def _team_outlook_lines(
    *,
    team: Team,
    recommendations: list[KeeperRecommendation],
    players: dict[uuid.UUID, Player],
) -> list[str]:
    selected = sorted(
        [row for row in recommendations if row.is_recommended],
        key=lambda row: row.keeper_cost_pick if row.keeper_cost_pick is not None else 999,
    )
    eligible = sorted(
        [row for row in recommendations if row.is_eligible and not row.is_recommended],
        key=lambda row: -(row.keeper_score or 0),
    )
    total_score = sum(row.keeper_score or 0 for row in selected)
    forfeited = [
        f"R{row.keeper_cost_round:g} / Pick {row.keeper_cost_pick:g}"
        for row in selected
        if row.keeper_cost_round is not None and row.keeper_cost_pick is not None
    ]

    lines = [
        f"{team.name}",
        f"Owner: {team.owner_name or 'Unassigned'}",
        f"Draft slot: {team.draft_slot or 'TBD'}",
        f"Recommended keepers: {len(selected)}",
        f"Total keeper score: {total_score:.1f}",
        f"Picks forfeited: {', '.join(forfeited) if forfeited else 'None'}",
        "",
        "Projected Keepers",
    ]
    if selected:
        for row in selected:
            player = players.get(row.player_id)
            lines.append(
                " - "
                f"{player.full_name if player else row.player_id} "
                f"({player.position if player else ''}) "
                f"score {row.keeper_score or 0:.1f}, "
                f"value {row.keeper_value or 0:.1f}"
            )
    else:
        lines.append(" - No keepers selected")

    lines.extend(["", "Watch List"])
    if eligible[:5]:
        for row in eligible[:5]:
            player = players.get(row.player_id)
            lines.append(
                " - "
                f"{player.full_name if player else row.player_id} "
                f"({player.position if player else ''}) "
                f"score {row.keeper_score or 0:.1f}, "
                f"reason: {row.reason or 'Eligible'}"
            )
    else:
        lines.append(" - No eligible bench options")

    return lines


def _build_pdf(pages: list[list[str]]) -> bytes:
    objects: list[bytes] = []
    page_object_numbers: list[int] = []

    for lines in pages:
        content = _page_stream(lines)
        content_object_number = len(objects) + 1
        objects.append(
            b"<< /Length "
            + str(len(content)).encode("ascii")
            + b" >>\nstream\n"
            + content
            + b"\nendstream"
        )
        page_object_number = len(objects) + 1
        page_object_numbers.append(page_object_number)
        objects.append(
            (
                "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] "
                f"/Contents {content_object_number} 0 R "
                "/Resources << /Font << /F1 0 0 R >> >> >>"
            ).encode("ascii")
        )

    font_object_number = len(objects) + 1
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    pages_object_number = len(objects) + 1
    kids = " ".join(f"{page_number} 0 R" for page_number in page_object_numbers)
    objects.append(
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>".encode("ascii")
    )
    catalog_object_number = len(objects) + 1
    objects.append(f"<< /Type /Catalog /Pages {pages_object_number} 0 R >>".encode("ascii"))

    patched_objects = []
    for index, obj in enumerate(objects, start=1):
        patched_objects.append(
            obj.replace(b"/Parent 0 0 R", f"/Parent {pages_object_number} 0 R".encode("ascii"))
            .replace(b"/F1 0 0 R", f"/F1 {font_object_number} 0 R".encode("ascii"))
        )

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(patched_objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode("ascii"))
        output.write(obj)
        output.write(b"\nendobj\n")

    xref_offset = output.tell()
    output.write(f"xref\n0 {len(patched_objects) + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.write(
        (
            f"trailer\n<< /Size {len(patched_objects) + 1} "
            f"/Root {catalog_object_number} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return output.getvalue()


def _page_stream(lines: list[str]) -> bytes:
    commands = ["BT", "/F1 16 Tf", "72 732 Td"]
    for index, line in enumerate(lines[:42]):
        size = 16 if index == 0 else 11
        if index == 1:
            commands.append("/F1 11 Tf")
        commands.append(f"({_escape_pdf_text(line)}) Tj")
        commands.append("0 -17 Td" if size == 11 else "0 -24 Td")
    commands.append("ET")
    return "\n".join(commands).encode("latin-1", errors="replace")


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
