from collections.abc import Generator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import not_authenticated
from app.db.session import SessionLocal
from app.models import User
from app.services import auth_service

SESSION_COOKIE = "r53_session"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise not_authenticated()
    user = auth_service.get_session_user(db, token)
    if user is None:
        raise not_authenticated()
    return user
