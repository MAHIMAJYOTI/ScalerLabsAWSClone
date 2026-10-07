from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_session_token, hash_token, verify_password
from app.db.base import utcnow
from app.models import AuthSession, User


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user: User) -> str:
    token = generate_session_token()
    now = utcnow()
    ttl = timedelta(hours=get_settings().SESSION_TTL_HOURS)
    db.add(
        AuthSession(
            token_hash=hash_token(token),
            user_id=user.id,
            created_at=now,
            expires_at=now + ttl,
            last_seen_at=now,
        )
    )
    db.commit()
    return token


def get_session_user(db: Session, token: str) -> User | None:
    """Resolve a session token; sliding expiry (extends on every use)."""
    now = utcnow()
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    )
    if session is None:
        return None
    if session.expires_at <= now:
        db.delete(session)
        db.commit()
        return None
    session.last_seen_at = now
    session.expires_at = now + timedelta(hours=get_settings().SESSION_TTL_HOURS)
    db.commit()
    return db.get(User, session.user_id)


def delete_session(db: Session, token: str) -> None:
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    )
    if session is not None:
        db.delete(session)
        db.commit()
