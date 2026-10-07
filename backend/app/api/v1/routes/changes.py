from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.common import ChangeOut
from app.services import change_service

router = APIRouter()


@router.get("/{change_id}", response_model=ChangeOut)
def get_change(
    change_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return change_service.get_change(db, change_id)
