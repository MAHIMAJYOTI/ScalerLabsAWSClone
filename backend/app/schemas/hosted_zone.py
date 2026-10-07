from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ChangeOut


class VpcIn(BaseModel):
    region: str = Field(min_length=1, max_length=32)
    vpc_id: str = Field(min_length=1, max_length=64)


class TagIn(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(max_length=256)


class HostedZoneCreate(BaseModel):
    name: str
    comment: str | None = Field(default=None, max_length=256)
    private_zone: bool = False
    vpcs: list[VpcIn] = []
    tags: list[TagIn] = []


class HostedZoneUpdate(BaseModel):
    comment: str | None = Field(default=None, max_length=256)


class HostedZoneListItem(BaseModel):
    id: str
    name: str
    private_zone: bool
    comment: str | None
    record_count: int
    created_by: str
    created_at: datetime
    updated_at: datetime


class HostedZoneListResponse(BaseModel):
    items: list[HostedZoneListItem]
    total: int
    page: int
    page_size: int


class HostedZoneDetail(BaseModel):
    id: str
    name: str
    caller_reference: str
    comment: str | None
    private_zone: bool
    record_count: int
    name_servers: list[str]
    vpcs: list[VpcIn]
    tags: list[TagIn]
    created_by: str
    created_at: datetime
    updated_at: datetime


class DelegationSet(BaseModel):
    name_servers: list[str]


class HostedZoneCreateResponse(BaseModel):
    hosted_zone: HostedZoneDetail
    delegation_set: DelegationSet | None
    change: ChangeOut
