from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlmodel import Session, col, select

from app.core.config import get_settings
from app.db.session import engine, get_session
from app.models import League, LeagueMembership, User
from app.models.messaging import Message, MessageRead
from app.services.auth import require_current_user, verify_session

router = APIRouter(prefix="/api", tags=["messages"])


# ---------------------------------------------------------------------------
# Connection manager for real-time WebSocket delivery
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, data: dict) -> None:
        sockets = set(self._connections.get(user_id, set()))
        dead: set[WebSocket] = set()
        for ws in sockets:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.get(user_id, set()).discard(ws)

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _message_to_dict(msg: Message, sender: User) -> dict[str, Any]:
    return {
        "id": str(msg.id),
        "senderId": str(msg.sender_id),
        "senderEmail": sender.email,
        "senderAlias": sender.alias,
        "senderAvatar": sender.avatar_data_url,
        "content": msg.content,
        "channelType": msg.channel_type,
        "leagueId": str(msg.league_id) if msg.league_id else None,
        "recipientId": str(msg.recipient_id) if msg.recipient_id else None,
        "createdAt": msg.created_at.isoformat(),
    }


def _get_unread_counts(db: Session, user_id: uuid.UUID) -> dict[str, int]:
    """Return {conversation_id: unread_count} for all conversations the user has."""
    memberships = db.exec(
        select(LeagueMembership).where(LeagueMembership.user_id == user_id)
    ).all()
    league_ids = [m.league_id for m in memberships]

    # All message IDs the user has already read
    read_ids: set[uuid.UUID] = set(
        db.exec(select(MessageRead.message_id).where(MessageRead.user_id == user_id)).all()
    )

    counts: dict[str, int] = {}

    # DM unread: messages sent TO this user that haven't been read
    dm_messages = db.exec(
        select(Message).where(
            Message.channel_type == "dm",
            Message.recipient_id == user_id,
        )
    ).all()
    for msg in dm_messages:
        if msg.id not in read_ids:
            key = str(msg.sender_id)
            counts[key] = counts.get(key, 0) + 1

    # League channel unread: messages in user's leagues not sent by them and not read
    for league_id in league_ids:
        league_msgs = db.exec(
            select(Message).where(
                Message.channel_type == "league",
                Message.league_id == league_id,
                Message.sender_id != user_id,
            )
        ).all()
        unread = sum(1 for m in league_msgs if m.id not in read_ids)
        if unread:
            counts[str(league_id)] = unread

    return counts


def _mark_conversation_read(db: Session, user_id: uuid.UUID, conversation_type: str, conversation_id: uuid.UUID) -> None:
    if conversation_type == "dm":
        msgs = db.exec(
            select(Message).where(
                Message.channel_type == "dm",
                Message.recipient_id == user_id,
                Message.sender_id == conversation_id,
            )
        ).all()
    elif conversation_type == "league":
        msgs = db.exec(
            select(Message).where(
                Message.channel_type == "league",
                Message.league_id == conversation_id,
                Message.sender_id != user_id,
            )
        ).all()
    else:
        return

    for msg in msgs:
        existing = db.exec(
            select(MessageRead).where(
                MessageRead.message_id == msg.id,
                MessageRead.user_id == user_id,
            )
        ).first()
        if not existing:
            db.add(MessageRead(message_id=msg.id, user_id=user_id))

    db.commit()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/messages/direct/{other_user_id}")
def get_direct_messages(
    other_user_id: uuid.UUID,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
) -> list[dict]:
    """Fetch DM history between the current user and another user."""
    messages = db.exec(
        select(Message)
        .where(
            Message.channel_type == "dm",
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.recipient_id == current_user.id),
            ),
        )
        .order_by(col(Message.created_at).desc())
        .limit(limit)
    ).all()

    sender_ids = {m.sender_id for m in messages}
    senders = {u.id: u for u in db.exec(select(User).where(User.id.in_(sender_ids))).all()}

    return [_message_to_dict(m, senders[m.sender_id]) for m in reversed(messages)]


@router.get("/messages/league/{league_id}")
def get_league_messages(
    league_id: uuid.UUID,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
) -> list[dict]:
    """Fetch league channel message history."""
    membership = db.exec(
        select(LeagueMembership).where(
            LeagueMembership.user_id == current_user.id,
            LeagueMembership.league_id == league_id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this league")

    messages = db.exec(
        select(Message)
        .where(
            Message.channel_type == "league",
            Message.league_id == league_id,
        )
        .order_by(col(Message.created_at).desc())
        .limit(limit)
    ).all()

    sender_ids = {m.sender_id for m in messages}
    senders = {u.id: u for u in db.exec(select(User).where(User.id.in_(sender_ids))).all()}

    return [_message_to_dict(m, senders[m.sender_id]) for m in reversed(messages)]


@router.get("/messages/contacts")
def get_messaging_contacts(
    db: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
) -> list[dict]:
    """Return all users the current user can directly message.

    Any user who holds a league_memberships row in at least one league the
    caller also belongs to is a valid contact — including commissioners who
    have no team assigned.  This endpoint is accessible to all league members
    (not gated to league admins like the full membership panel).
    """
    my_league_ids = db.exec(
        select(LeagueMembership.league_id).where(LeagueMembership.user_id == current_user.id)
    ).all()

    if not my_league_ids:
        return []

    # All user IDs that share at least one league with the caller
    contact_ids: set[uuid.UUID] = set(
        db.exec(
            select(LeagueMembership.user_id).where(
                LeagueMembership.league_id.in_(my_league_ids)
            )
        ).all()
    )
    contact_ids.discard(current_user.id)

    if not contact_ids:
        return []

    users = db.exec(
        select(User).where(User.id.in_(contact_ids), User.is_active == True)  # noqa: E712
    ).all()

    return [
        {
            "userId": str(u.id),
            "email": u.email,
            "alias": u.alias,
            "avatarDataUrl": u.avatar_data_url,
        }
        for u in sorted(users, key=lambda u: (u.alias or u.email).lower())
    ]


@router.get("/messages/unread")
def get_unread_counts(
    db: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
) -> dict[str, int]:
    """Return unread message count per conversation (keyed by conversation ID)."""
    return _get_unread_counts(db, current_user.id)


class MarkReadBody(BaseModel):
    conversationType: str  # "dm" | "league"
    conversationId: str


@router.post("/messages/read")
def mark_read(
    body: MarkReadBody,
    db: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
) -> dict:
    """Mark all messages in a conversation as read."""
    try:
        conv_id = uuid.UUID(body.conversationId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversationId")

    _mark_conversation_read(db, current_user.id, body.conversationType, conv_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/messages")
async def websocket_messages(websocket: WebSocket) -> None:
    settings = get_settings()
    session_cookie = websocket.cookies.get(settings.session_cookie_name)
    user_id = verify_session(session_cookie)

    if not user_id:
        await websocket.close(code=4001)
        return

    with Session(engine) as db:
        user = db.get(User, user_id)
        if not user or not user.is_active:
            await websocket.close(code=4001)
            return

    await manager.connect(websocket, user_id)

    # Send current unread counts on connect
    with Session(engine) as db:
        counts = _get_unread_counts(db, user_id)
    await websocket.send_json({"type": "unread_counts", "counts": counts})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "send_dm":
                await _handle_send_dm(websocket, user_id, data)
            elif msg_type == "send_league":
                await _handle_send_league(websocket, user_id, data)
            elif msg_type == "mark_read":
                await _handle_mark_read(user_id, data)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(websocket, user_id)


async def _handle_send_dm(websocket: WebSocket, sender_id: uuid.UUID, data: dict) -> None:
    recipient_id_str = data.get("recipientId", "")
    content = (data.get("content") or "").strip()

    if not recipient_id_str or not content:
        await websocket.send_json({"type": "error", "detail": "recipientId and content required"})
        return

    try:
        recipient_id = uuid.UUID(recipient_id_str)
    except ValueError:
        await websocket.send_json({"type": "error", "detail": "Invalid recipientId"})
        return

    if len(content) > 4000:
        await websocket.send_json({"type": "error", "detail": "Message too long (max 4000 chars)"})
        return

    with Session(engine) as db:
        sender = db.get(User, sender_id)
        recipient = db.get(User, recipient_id)
        if not sender or not recipient or not recipient.is_active:
            await websocket.send_json({"type": "error", "detail": "User not found"})
            return

        # Both parties must share at least one league (covers commissioners who
        # have a league_memberships row but no team assigned).
        sender_leagues: set[uuid.UUID] = set(
            db.exec(select(LeagueMembership.league_id).where(LeagueMembership.user_id == sender_id)).all()
        )
        recipient_leagues: set[uuid.UUID] = set(
            db.exec(select(LeagueMembership.league_id).where(LeagueMembership.user_id == recipient_id)).all()
        )
        if not (sender_leagues & recipient_leagues):
            await websocket.send_json({"type": "error", "detail": "Cannot message this user"})
            return

        msg = Message(sender_id=sender_id, channel_type="dm", recipient_id=recipient_id, content=content)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_dict = _message_to_dict(msg, sender)

    event = {"type": "new_message", "message": msg_dict}
    await websocket.send_json(event)
    await manager.send_to_user(recipient_id, event)


async def _handle_send_league(websocket: WebSocket, sender_id: uuid.UUID, data: dict) -> None:
    league_id_str = data.get("leagueId", "")
    content = (data.get("content") or "").strip()

    if not league_id_str or not content:
        await websocket.send_json({"type": "error", "detail": "leagueId and content required"})
        return

    try:
        league_id = uuid.UUID(league_id_str)
    except ValueError:
        await websocket.send_json({"type": "error", "detail": "Invalid leagueId"})
        return

    if len(content) > 4000:
        await websocket.send_json({"type": "error", "detail": "Message too long (max 4000 chars)"})
        return

    with Session(engine) as db:
        membership = db.exec(
            select(LeagueMembership).where(
                LeagueMembership.user_id == sender_id,
                LeagueMembership.league_id == league_id,
            )
        ).first()
        if not membership:
            await websocket.send_json({"type": "error", "detail": "Not a member of this league"})
            return

        sender = db.get(User, sender_id)
        if not sender:
            return

        msg = Message(sender_id=sender_id, channel_type="league", league_id=league_id, content=content)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_dict = _message_to_dict(msg, sender)

        other_member_ids = db.exec(
            select(LeagueMembership.user_id).where(
                LeagueMembership.league_id == league_id,
                LeagueMembership.user_id != sender_id,
            )
        ).all()

    event = {"type": "new_message", "message": msg_dict}
    await websocket.send_json(event)
    for member_id in other_member_ids:
        await manager.send_to_user(member_id, event)


async def _handle_mark_read(user_id: uuid.UUID, data: dict) -> None:
    conversation_type = data.get("conversationType", "")
    conversation_id_str = data.get("conversationId", "")

    if not conversation_type or not conversation_id_str:
        return

    try:
        conversation_id = uuid.UUID(conversation_id_str)
    except ValueError:
        return

    with Session(engine) as db:
        _mark_conversation_read(db, user_id, conversation_type, conversation_id)
