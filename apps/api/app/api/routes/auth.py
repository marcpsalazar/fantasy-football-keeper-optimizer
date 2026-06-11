from __future__ import annotations

import json
import re
import urllib.request
from typing import Any, Literal
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import get_session
from app.models import (
    AppDefaultOptimizerSettings,
    KeeperRecommendation,
    ManualOverride,
    OptimizerSettings,
    Player,
    Team,
    TeamScenarioSelection,
    User,
)
from app.services.sleeper_import import SLEEPER_THUMB_URL
from app.schemas.optimizer import OptimizerSettingsUpdate
from app.services.auth import (
    clear_session_cookie,
    hash_password,
    require_current_user,
    require_platform_admin,
    set_session_cookie,
    verify_password,
)
from app.services.yahoo_oauth import (
    YahooOAuthError,
    build_auth_url,
    exchange_code,
    get_token_status,
    upsert_token,
    validate_state,
)

router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreateRequest(BaseModel):
    email: str
    password: str
    alias: str | None = None
    role: Literal["platform_admin", "user"] = "user"
    is_active: bool = True
    team_id: str | None = None


class UserRead(BaseModel):
    id: str
    email: str
    alias: str | None = None
    role: str
    is_active: bool
    avatar_data_url: str | None = None
    team_id: str | None = None
    team_name: str | None = None


class UserUpdateRequest(BaseModel):
    email: str | None = None
    alias: str | None = None
    password: str | None = None
    role: Literal["platform_admin", "user"] | None = None
    is_active: bool | None = None
    team_id: str | None = None


class PasswordResetRequest(BaseModel):
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    avatar_data_url: str | None = None
    alias: str | None = None


def user_payload(user: User | None, session: Session | None = None) -> dict[str, Any] | None:
    if user is None:
        return None
    assigned_team = None
    if session is not None:
        assigned_team = session.exec(
            select(Team).where(Team.user_id == user.id).order_by(Team.name)
        ).first()
    return {
        "id": str(user.id),
        "email": user.email,
        "alias": user.alias,
        "role": user.role,
        "is_active": user.is_active,
        "avatar_data_url": user.avatar_data_url,
        "team_id": str(assigned_team.id) if assigned_team else None,
        "team_name": assigned_team.name if assigned_team else None,
    }


def admin_user_payload(session: Session, user: User) -> dict[str, Any]:
    assigned_team = session.exec(
        select(Team).where(Team.user_id == user.id).order_by(Team.name)
    ).first()
    return {
        **(user_payload(user, session) or {}),
        "team_id": str(assigned_team.id) if assigned_team else None,
        "team_name": assigned_team.name if assigned_team else None,
    }


@router.post("/auth/login")
def login(
    payload: LoginRequest,
    response: Response,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    user = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    set_session_cookie(response, user)
    return {"user": user_payload(user, session)}


@router.post("/auth/logout")
def logout(response: Response) -> dict[str, str]:
    clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/auth/me")
def me(
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return {"user": user_payload(user, session)}


@router.patch("/auth/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    update_data = payload.model_dump(exclude_unset=True)
    if "avatar_data_url" in update_data:
        avatar_data_url = update_data["avatar_data_url"]
        if avatar_data_url:
            _validate_avatar_data_url(avatar_data_url)
        user.avatar_data_url = avatar_data_url
    if "alias" in update_data:
        user.alias = _clean_alias(update_data["alias"])
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"user": user_payload(user, session)}


@router.post("/auth/password")
def change_password(
    payload: PasswordChangeRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if not payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password is required")
    user.password_hash = hash_password(payload.new_password)
    session.add(user)
    session.commit()
    return {"status": "ok"}


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    email = payload.email.lower()
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        email=email,
        alias=_clean_alias(payload.alias),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    session.add(user)
    session.flush()
    _assign_user_to_team(session, user, payload.team_id)
    session.commit()
    session.refresh(user)
    return admin_user_payload(session, user)


@router.get("/admin/users")
def list_users(
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    users = session.exec(select(User).order_by(User.email)).all()
    rows = [admin_user_payload(session, user) for user in users]
    return {"count": len(rows), "rows": rows}


@router.patch("/admin/users/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    user = _require_user(session, user_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] is not None:
        email = update_data["email"].lower()
        existing = session.exec(select(User).where(User.email == email, User.id != user.id)).first()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        user.email = email
    if "alias" in update_data:
        user.alias = _clean_alias(update_data["alias"])
    if "password" in update_data and update_data["password"] is not None:
        user.password_hash = hash_password(update_data["password"])
    if "role" in update_data and update_data["role"] is not None:
        user.role = update_data["role"]
    if "is_active" in update_data and update_data["is_active"] is not None:
        user.is_active = update_data["is_active"]
    if "team_id" in update_data:
        _assign_user_to_team(session, user, update_data["team_id"])
    session.add(user)
    session.commit()
    session.refresh(user)
    return admin_user_payload(session, user)


@router.post("/admin/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: PasswordResetRequest,
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    user = _require_user(session, user_id)
    user.password_hash = hash_password(payload.password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return admin_user_payload(session, user)


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> Response:
    user = _require_user(session, user_id)
    if user.role == "platform_admin":
        admin_count = session.exec(select(User).where(User.role == "platform_admin")).all()
        if len(admin_count) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last platform admin",
            )

    for team in session.exec(select(Team).where(Team.user_id == user.id)).all():
        team.user_id = None
        session.add(team)
    for model in (TeamScenarioSelection, KeeperRecommendation, ManualOverride, OptimizerSettings):
        for row in session.exec(select(model).where(model.user_id == user.id)).all():
            session.delete(row)
    session.delete(user)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/auth/yahoo/init")
def yahoo_init(
    user: User | None = Depends(require_current_user),
) -> dict[str, str]:
    """Return a Yahoo OAuth2 authorization URL for the authenticated user."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    settings = get_settings()
    if not settings.yahoo_client_id or not settings.yahoo_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Yahoo integration is not configured on this server.",
        )
    auth_url = build_auth_url(user.id, settings)
    return {"auth_url": auth_url}


@router.get("/auth/yahoo/callback")
def yahoo_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Handle Yahoo OAuth2 callback. Exchanges code for tokens and redirects to frontend."""
    settings = get_settings()
    frontend_url = settings.frontend_url

    if error:
        return RedirectResponse(url=f"{frontend_url}?yahoo_error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}?yahoo_error=missing_params")

    try:
        user_id = validate_state(state, settings)
    except ValueError as exc:
        return RedirectResponse(url=f"{frontend_url}?yahoo_error=invalid_state&detail={exc}")

    user = session.get(User, user_id)
    if user is None:
        return RedirectResponse(url=f"{frontend_url}?yahoo_error=user_not_found")

    try:
        token_data = exchange_code(code, settings)
    except YahooOAuthError as exc:
        return RedirectResponse(url=f"{frontend_url}?yahoo_error=token_exchange_failed&detail={exc}")

    upsert_token(session, user_id, token_data)
    return RedirectResponse(url=f"{frontend_url}?yahoo_connected=1")


@router.get("/auth/yahoo/status")
def yahoo_status(
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Return whether the current user has a connected Yahoo account."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return get_token_status(session, user.id)


def _require_user(session: Session, user_id: str) -> User:
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID") from exc
    user = session.get(User, parsed_user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _validate_avatar_data_url(value: str) -> None:
    if len(value) > 1_500_000:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar image is too large",
        )
    if not value.startswith("data:image/") or ";base64," not in value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be a base64 image data URL",
        )


def _clean_alias(value: str | None) -> str | None:
    if value is None:
        return None
    alias = value.strip()
    if not alias:
        return None
    if len(alias) > 120:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alias is too long")
    return alias


def _assign_user_to_team(session: Session, user: User, team_id: str | None) -> None:
    for assigned_team in session.exec(select(Team).where(Team.user_id == user.id)).all():
        assigned_team.user_id = None
        session.add(assigned_team)
    if not team_id:
        return
    try:
        parsed_team_id = uuid.UUID(team_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team ID") from exc
    team = session.get(Team, parsed_team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    team.user_id = user.id
    session.add(team)


@router.get("/admin/defaults/optimizer-settings")
def read_default_optimizer_settings(
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return _default_settings_payload(_active_default_settings(session))


@router.patch("/admin/defaults/optimizer-settings")
def update_default_optimizer_settings(
    payload: OptimizerSettingsUpdate,
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    settings = _active_default_settings(session)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(settings, field_name):
            setattr(settings, field_name, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return _default_settings_payload(settings)


def _active_default_settings(session: Session) -> AppDefaultOptimizerSettings:
    settings = session.exec(
        select(AppDefaultOptimizerSettings)
        .where(AppDefaultOptimizerSettings.is_active.is_(True))
        .order_by(AppDefaultOptimizerSettings.created_at.desc())
    ).first()
    if settings is None:
        settings = AppDefaultOptimizerSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def _default_settings_payload(settings: AppDefaultOptimizerSettings) -> dict[str, Any]:
    return {
        "id": str(settings.id),
        "name": settings.name,
        "max_keepers": settings.max_keepers,
        "max_keepers_per_position": settings.max_keepers_per_position,
        "max_qb_keepers": settings.max_qb_keepers,
        "minimum_keeper_value": settings.minimum_keeper_value,
        "max_adp_cap": settings.max_adp_cap,
        "minimum_keeper_score": settings.minimum_keeper_score,
        "qb_weight": settings.qb_weight,
        "rb_weight": settings.rb_weight,
        "wr_weight": settings.wr_weight,
        "te_weight": settings.te_weight,
        "k_weight": settings.k_weight,
        "def_weight": settings.def_weight,
        "qb_max_adp": settings.qb_max_adp,
        "elite_qb_cutoff": settings.elite_qb_cutoff,
        "elite_qb_max_negative_edge": settings.elite_qb_max_negative_edge,
        "talent_anchor": settings.talent_anchor,
        "talent_divisor": settings.talent_divisor,
        "starter_status_bonus": settings.starter_status_bonus,
        "bench_status_bonus": settings.bench_status_bonus,
        "ir_status_bonus": settings.ir_status_bonus,
        "enable_draft_slot_bonus": settings.enable_draft_slot_bonus,
        "enable_qb_scarcity_bonus": settings.enable_qb_scarcity_bonus,
        "enable_elite_player_bonus": settings.enable_elite_player_bonus,
        "elite_player_max_negative_edge": settings.elite_player_max_negative_edge,
        "created_at": settings.created_at.isoformat(),
        "updated_at": settings.updated_at.isoformat(),
    }


@router.post("/admin/players/backfill-images")
def backfill_player_images(
    key: str | None = Query(default=None),
    session: Session = Depends(get_session),
    settings=Depends(get_settings),
) -> dict[str, Any]:
    """Match DB players with no image_url to Sleeper by name+position and populate image_url + external_id."""
    if key != settings.session_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    _SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|ii|iii|iv|v|vi)$", re.IGNORECASE)

    def strip_suffix(name: str) -> str:
        return _SUFFIX_RE.sub("", name).strip()

    req = urllib.request.Request(
        "https://api.sleeper.app/v1/players/nfl",
        headers={"User-Agent": "keeper-optimizer/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        players_db = json.loads(resp.read().decode("utf-8"))

    _pos_map = {"QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE", "K": "K", "DEF": "DST", "DST": "DST"}
    _valid = frozenset({"QB", "RB", "WR", "TE", "K", "DST"})

    lookup: dict[str, list[tuple[str, str]]] = {}
    for pid, p in players_db.items():
        if not isinstance(p, dict):
            continue
        first = (p.get("first_name") or "").strip()
        last = (p.get("last_name") or "").strip()
        full = p.get("full_name") or f"{first} {last}".strip()
        if not full:
            continue
        pos = _pos_map.get(str(p.get("position") or "").upper())
        if pos not in _valid:
            continue
        entry = (str(pid), SLEEPER_THUMB_URL.format(pid))
        for variant in {full.lower(), strip_suffix(full).lower()}:
            lookup.setdefault(f"{variant}|{pos}", []).append(entry)

    db_players = session.exec(select(Player).where(Player.image_url.is_(None))).all()  # type: ignore[union-attr]
    updated = skipped_ambiguous = skipped_no_match = 0

    for player in db_players:
        lookup_key = f"{player.full_name.lower()}|{player.position}"
        if lookup_key not in lookup:
            lookup_key = f"{strip_suffix(player.full_name).lower()}|{player.position}"
        matches = lookup.get(lookup_key, [])
        if not matches:
            skipped_no_match += 1
            continue
        if len(matches) > 1:
            team_matches = [(pid, url) for pid, url in matches if players_db[pid].get("team") == player.nfl_team]
            if len(team_matches) == 1:
                matches = team_matches
            else:
                skipped_ambiguous += 1
                continue
        sleeper_id, image_url = matches[0]
        player.image_url = image_url
        if player.external_id is None:
            player.external_id = sleeper_id
        updated += 1

    session.commit()
    return {"updated": updated, "skipped_no_match": skipped_no_match, "skipped_ambiguous": skipped_ambiguous}
