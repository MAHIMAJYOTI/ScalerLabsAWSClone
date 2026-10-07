from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.common import BatchIds, ChangeOut
from app.schemas.record import (
    RecordBatchCreate,
    RecordCreate,
    RecordCreateResponse,
    RecordListResponse,
    RecordOut,
    RecordUpdate,
    RecordUpdateResponse,
    ZoneFileImportRequest,
    ZoneFileImportResponse,
)
from app.services import hosted_zone_service as zones
from app.services import record_service, zone_file_service

router = APIRouter()


@router.get("", response_model=RecordListResponse)
def list_records(
    zone_id: str,
    q: str | None = None,
    type: str | None = None,  # noqa: A002 - matches the public query param name
    routing_policy: str | None = None,
    alias: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=300),
    sort_by: str | None = Query(default=None, pattern="^(name|type|ttl|routing_policy)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    records, total, total_unfiltered = record_service.list_records(
        db,
        zone,
        q=q,
        types=type,
        routing_policy=routing_policy,
        alias=alias,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "items": [record_service.record_to_dict(r, zone) for r in records],
        "total": total,
        "total_unfiltered": total_unfiltered,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=RecordCreateResponse, status_code=201)
def create_records(
    zone_id: str,
    payload: RecordCreate | RecordBatchCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    items = payload.records if isinstance(payload, RecordBatchCreate) else [payload]
    records, change = record_service.create_records(db, zone, items)
    return {
        "records": [record_service.record_to_dict(r, zone) for r in records],
        "change": change,
    }


@router.post("/import", response_model=ZoneFileImportResponse, status_code=201)
def import_zone_file(
    zone_id: str,
    payload: ZoneFileImportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    records, skipped, change = zone_file_service.import_zone_file(
        db, zone, payload.zone_file
    )
    return {"created": len(records), "skipped": skipped, "change": change}


@router.post("/batch-delete")
def batch_delete_records(
    zone_id: str,
    payload: BatchIds,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    deleted_ids, change = record_service.batch_delete_records(db, zone, payload.ids)
    return {"deleted_ids": deleted_ids, "change": ChangeOut.model_validate(change)}


@router.get("/{record_id}", response_model=RecordOut)
def get_record(
    zone_id: str,
    record_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    record = record_service.get_record(db, zone, record_id)
    return record_service.record_to_dict(record, zone)


@router.put("/{record_id}", response_model=RecordUpdateResponse)
def update_record(
    zone_id: str,
    record_id: str,
    payload: RecordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    record = record_service.get_record(db, zone, record_id)
    record, change = record_service.update_record(db, zone, record, payload)
    return {"record": record_service.record_to_dict(record, zone), "change": change}


@router.delete("/{record_id}")
def delete_record(
    zone_id: str,
    record_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    record = record_service.get_record(db, zone, record_id)
    change = record_service.delete_record(db, zone, record)
    return {"change": ChangeOut.model_validate(change)}
