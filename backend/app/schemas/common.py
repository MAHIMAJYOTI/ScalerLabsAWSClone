from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    comment: str | None = None
    submitted_at: datetime


class BatchIds(BaseModel):
    ids: list[str]
