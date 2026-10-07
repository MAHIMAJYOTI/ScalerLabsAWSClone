from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ChangeOut


class RecordBase(BaseModel):
    ttl: int | None = None
    values: list[str] | None = None
    routing_policy: str = "SIMPLE"
    set_identifier: str | None = Field(default=None, max_length=128)
    weight: int | None = None
    region: str | None = None
    failover: str | None = None
    geo_continent: str | None = None
    geo_country: str | None = None
    geo_subdivision: str | None = None
    health_check_id: str | None = None
    is_alias: bool = False
    alias_dns_name: str | None = None
    alias_hosted_zone_id: str | None = None
    alias_evaluate_target_health: bool = False

    @field_validator("values", mode="before")
    @classmethod
    def _coerce_values(cls, v):
        if isinstance(v, str):
            return [v]
        return v


class RecordCreate(RecordBase):
    name: str = ""
    type: str


class RecordBatchCreate(BaseModel):
    records: list[RecordCreate] = Field(min_length=1)


class RecordUpdate(RecordBase):
    name: str | None = None
    type: str | None = None


class RecordOut(BaseModel):
    id: str
    zone_id: str
    name: str
    type: str
    ttl: int | None
    routing_policy: str
    set_identifier: str | None
    weight: int | None
    region: str | None
    failover: str | None
    geo_continent: str | None
    geo_country: str | None
    geo_subdivision: str | None
    multivalue_answer: bool
    health_check_id: str | None
    is_alias: bool
    alias_dns_name: str | None
    alias_hosted_zone_id: str | None
    alias_evaluate_target_health: bool
    values: list[str]
    protected: bool
    created_at: datetime
    updated_at: datetime


class RecordListResponse(BaseModel):
    items: list[RecordOut]
    total: int
    total_unfiltered: int
    page: int
    page_size: int


class RecordCreateResponse(BaseModel):
    records: list[RecordOut]
    change: ChangeOut


class RecordUpdateResponse(BaseModel):
    record: RecordOut
    change: ChangeOut


class ZoneFileImportRequest(BaseModel):
    zone_file: str


class SkippedRecord(BaseModel):
    name: str
    type: str
    reason: str


class ZoneFileImportResponse(BaseModel):
    created: int
    skipped: list[SkippedRecord]
    change: ChangeOut
