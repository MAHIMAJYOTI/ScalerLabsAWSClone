from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.errors import no_such_change
from app.db.base import utcnow
from app.models import Change
from app.services.id_gen import new_change_id

PROPAGATION_SECONDS = 3


def create_change(db: Session, comment: str | None = None) -> Change:
    """Add a PENDING change to the current transaction (caller commits)."""
    change = Change(
        id=new_change_id(), status="PENDING", comment=comment, submitted_at=utcnow()
    )
    db.add(change)
    db.flush()
    return change


def get_change(db: Session, change_id: str) -> Change:
    change = db.get(Change, change_id)
    if change is None:
        raise no_such_change(change_id)
    if (
        change.status == "PENDING"
        and utcnow() - change.submitted_at >= timedelta(seconds=PROPAGATION_SECONDS)
    ):
        change.status = "INSYNC"
        db.commit()
    return change
