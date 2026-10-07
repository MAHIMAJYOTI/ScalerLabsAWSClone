from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.common import BatchIds, ChangeOut
from app.schemas.hosted_zone import (
    DelegationSet,
    HostedZoneCreate,
    HostedZoneCreateResponse,
    HostedZoneDetail,
    HostedZoneListResponse,
    HostedZoneUpdate,
)
from app.services import hosted_zone_service as zones
from app.services import zone_file_service

router = APIRouter()


@router.get("", response_model=HostedZoneListResponse)
def list_hosted_zones(
    q: str | None = None,
    zone_type: str | None = Query(default=None, alias="type", pattern="^(public|private)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    sort_by: str = Query(default="name", pattern="^(name|record_count|created_at|comment)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows, total = zones.list_zones(
        db,
        user,
        q=q,
        zone_type=zone_type,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "items": [zones.zone_list_item(zone, count) for zone, count in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=HostedZoneCreateResponse, status_code=201)
def create_hosted_zone(
    payload: HostedZoneCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone, name_servers, change = zones.create_zone(db, user, payload)
    return {
        "hosted_zone": zones.zone_detail(db, zone),
        "delegation_set": (
            None if zone.private_zone else DelegationSet(name_servers=name_servers)
        ),
        "change": change,
    }


@router.post("/batch-delete")
def batch_delete_hosted_zones(
    payload: BatchIds,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"results": zones.batch_delete_zones(db, user, payload.ids)}


@router.get("/{zone_id}/export")
def export_hosted_zone(
    zone_id: str,
    format: str = Query(default="bind", pattern="^(bind|json)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    filename = zone.name.rstrip(".")
    if format == "json":
        return JSONResponse(
            content=zone_file_service.export_json(db, zone),
            headers={
                "Content-Disposition": f'attachment; filename="{filename}.json"'
            },
        )
    return PlainTextResponse(
        zone_file_service.export_bind(db, zone),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zone"'},
    )


@router.get("/{zone_id}", response_model=HostedZoneDetail)
def get_hosted_zone(
    zone_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    return zones.zone_detail(db, zone)


@router.patch("/{zone_id}", response_model=HostedZoneDetail)
def update_hosted_zone(
    zone_id: str,
    payload: HostedZoneUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    zone = zones.update_comment(db, zone, payload.comment)
    return zones.zone_detail(db, zone)


@router.delete("/{zone_id}")
def delete_hosted_zone(
    zone_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = zones.get_zone(db, user, zone_id)
    change = zones.delete_zone(db, zone)
    return {"change": ChangeOut.model_validate(change)}
