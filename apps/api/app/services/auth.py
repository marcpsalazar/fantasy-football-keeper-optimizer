from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from typing import TYPE_CHECKING

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import get_session
from app.models import User

if TYPE_CHECKING:
    from app.models.membership import LeagueMembership

PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    encoded = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt}${encoded}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, iterations, salt, expected = password_hash.split("$", 3)
        if scheme != PASSWORD_SCHEME:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        actual = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def sign_session(user_id: uuid.UUID) -> str:
    settings = get_settings()
    payload = str(user_id)
    signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}.{signature}"


def verify_session(value: str | None) -> uuid.UUID | None:
    if not value or "." not in value:
        return None
    payload, signature = value.rsplit(".", 1)
    expected = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        return uuid.UUID(payload)
    except ValueError:
        return None


def set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=sign_session(user.id),
        httponly=True,
        samesite=settings.cookie_samesite_policy,
        secure=settings.use_secure_session_cookie,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.use_secure_session_cookie,
        samesite=settings.cookie_samesite_policy,
    )


def users_exist(session: Session) -> bool:
    return session.exec(select(User.id).limit(1)).first() is not None


def current_user_or_none(
    session: Session = Depends(get_session),
    session_cookie: str | None = Cookie(default=None, alias=get_settings().session_cookie_name),
) -> User | None:
    user_id = verify_session(session_cookie)
    if user_id is None:
        return None
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def require_current_user(
    session: Session = Depends(get_session),
    user: User | None = Depends(current_user_or_none),
) -> User | None:
    if user is not None:
        return user
    if not users_exist(session):
        return None
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def require_platform_admin(user: User | None = Depends(require_current_user)) -> User | None:
    if user is None:
        return None
    if user.role != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin access required")
    return user


# Deprecated alias — kept so existing import sites compile until migrated.
require_admin = require_platform_admin


def _get_league_membership(session: Session, user: User, league_id: uuid.UUID) -> LeagueMembership | None:
    from app.models.membership import LeagueMembership as _LeagueMembership
    return session.exec(
        select(_LeagueMembership).where(
            _LeagueMembership.user_id == user.id,
            _LeagueMembership.league_id == league_id,
        )
    ).first()


def assert_league_admin(session: Session, user: User | None, league_id: uuid.UUID) -> None:
    """Raise 401/403 unless user is a league admin or platform admin for this league.
    user=None is the no-users-exist bypass — access is permitted."""
    if user is None:
        return
    if user.role == "platform_admin":
        return
    membership = _get_league_membership(session, user, league_id)
    if membership is None or membership.role != "league_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin access required")


def assert_league_member(session: Session, user: User | None, league_id: uuid.UUID) -> None:
    """Raise 401/403 unless user has any membership in this league, or is platform admin.
    user=None is the no-users-exist bypass — access is permitted."""
    if user is None:
        return
    if user.role == "platform_admin":
        return
    membership = _get_league_membership(session, user, league_id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League membership required")
