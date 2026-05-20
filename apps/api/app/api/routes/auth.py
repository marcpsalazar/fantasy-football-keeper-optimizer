from __future__ import annotations

from typing import Any, Literal
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import (
    AppDefaultOptimizerSettings,
    KeeperRecommendation,
    ManualOverride,
    OptimizerSettings,
    Team,
    TeamScenarioSelection,
    User,
)
from app.schemas.optimizer import OptimizerSettingsUpdate
from app.services.auth import (
    clear_session_cookie,
    hash_password,
    require_admin,
    require_current_user,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreateRequest(BaseModel):
    email: str
    password: str
    role: Literal["admin", "user"] = "user"
    is_active: bool = True
    team_id: str | None = None


class UserRead(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool


class UserUpdateRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    role: Literal["admin", "user"] | None = None
    is_active: bool | None = None
    team_id: str | None = None


class PasswordResetRequest(BaseModel):
    password: str


def user_payload(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


def admin_user_payload(session: Session, user: User) -> dict[str, Any]:
    assigned_team = session.exec(
        select(Team).where(Team.user_id == user.id).order_by(Team.name)
    ).first()
    return {
        **(user_payload(user) or {}),
        "password": user.password,
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
    return {"user": user_payload(user)}


@router.post("/auth/logout")
def logout(response: Response) -> dict[str, str]:
    clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/auth/me")
def me(user: User | None = Depends(require_current_user)) -> dict[str, Any]:
    return {"user": user_payload(user)}


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    email = payload.email.lower()
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        password=payload.password,
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    users = session.exec(select(User).order_by(User.email)).all()
    rows = [admin_user_payload(session, user) for user in users]
    return {"count": len(rows), "rows": rows}


@router.patch("/admin/users/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    _: User | None = Depends(require_admin),
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
    if "password" in update_data and update_data["password"] is not None:
        user.password_hash = hash_password(update_data["password"])
        user.password = update_data["password"]
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    user = _require_user(session, user_id)
    user.password_hash = hash_password(payload.password)
    user.password = payload.password
    session.add(user)
    session.commit()
    session.refresh(user)
    return admin_user_payload(session, user)


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> Response:
    user = _require_user(session, user_id)
    if user.role == "admin":
        admin_count = session.exec(select(User).where(User.role == "admin")).all()
        if len(admin_count) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin user",
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


def _require_user(session: Session, user_id: str) -> User:
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID") from exc
    user = session.get(User, parsed_user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return _default_settings_payload(_active_default_settings(session))


@router.patch("/admin/defaults/optimizer-settings")
def update_default_optimizer_settings(
    payload: OptimizerSettingsUpdate,
    _: User | None = Depends(require_admin),
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
        "created_at": settings.created_at.isoformat(),
        "updated_at": settings.updated_at.isoformat(),
    }
