from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class Change(Base):
    __tablename__ = "changes"

    id: Mapped[str] = mapped_column(String(21), primary_key=True)
    status: Mapped[str] = mapped_column(String(10), default="PENDING")
    comment: Mapped[str | None] = mapped_column(String(256))
    submitted_at: Mapped[datetime] = mapped_column(default=utcnow)
