from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def ensure_sqlite_parent_dir(database_url: str) -> None:
    """Create the SQLite file's parent directory (e.g. ./data or a mounted /data)."""
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return
    path = database_url[len(prefix) :]
    if path in ("", ":memory:"):
        return
    Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)


def utcnow() -> datetime:
    """Naive UTC timestamp — SQLite stores datetimes naive, so stay naive everywhere."""
    return datetime.now(UTC).replace(tzinfo=None)
