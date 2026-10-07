from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import (
    ApiError,
    hosted_zone_not_empty,
    invalid_input,
    no_such_hosted_zone,
    too_many_tag_keys,
)
from app.db.base import utcnow
from app.models import (
    Change,
    DelegationNameServer,
    HostedZone,
    HostedZoneTag,
    HostedZoneVpc,
    RecordSet,
    ResourceRecord,
    User,
)
from app.schemas.hosted_zone import HostedZoneCreate, TagIn, VpcIn
from app.services import dns_validation
from app.services.change_service import create_change
from app.services.id_gen import (
    generate_name_servers,
    new_caller_reference,
    new_record_id,
    new_zone_id,
)

MAX_TAGS = 50
APEX_NS_TTL = 172800
APEX_SOA_TTL = 900
CREATED_BY = "Route 53"

# Route53 uses this fixed placeholder delegation set for private hosted zones
# (no public delegation); public zones get a random per-zone set.
PRIVATE_NAME_SERVERS = [
    "ns-0.awsdns-00.com",
    "ns-1024.awsdns-00.org",
    "ns-512.awsdns-00.net",
    "ns-1536.awsdns-00.co.uk",
]


def _validate_tags(tags: list[TagIn]) -> None:
    if len(tags) > MAX_TAGS:
        raise too_many_tag_keys()
    keys = [t.key for t in tags]
    if len(keys) != len(set(keys)):
        raise invalid_input("Duplicate tag keys are not allowed.")


def get_zone(db: Session, user: User, zone_id: str) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    if zone is None or zone.owner_id != user.id:
        raise no_such_hosted_zone(zone_id)
    return zone


def record_count(db: Session, zone_id: str) -> int:
    return db.scalar(
        select(func.count(RecordSet.id)).where(RecordSet.zone_id == zone_id)
    )


def create_zone(
    db: Session,
    user: User,
    data: HostedZoneCreate,
    caller_reference: str | None = None,
) -> tuple[HostedZone, list[str], Change]:
    name = dns_validation.normalize_zone_name(data.name)
    if data.private_zone and not data.vpcs:
        raise invalid_input("Private hosted zones require at least one VPC association.")
    if not data.private_zone and data.vpcs:
        raise invalid_input("VPC associations are only allowed for private hosted zones.")
    _validate_tags(data.tags)

    zone = HostedZone(
        id=new_zone_id(),
        owner_id=user.id,
        name=name,
        caller_reference=caller_reference or new_caller_reference(),
        comment=data.comment,
        private_zone=data.private_zone,
    )
    db.add(zone)
    db.flush()

    for vpc in data.vpcs:
        db.add(HostedZoneVpc(zone_id=zone.id, vpc_region=vpc.region, vpc_id=vpc.vpc_id))
    for tag in data.tags:
        db.add(HostedZoneTag(zone_id=zone.id, key=tag.key, value=tag.value))

    if data.private_zone:
        ns_names = list(PRIVATE_NAME_SERVERS)
    else:
        ns_names = generate_name_servers()
        for position, ns in enumerate(ns_names):
            db.add(
                DelegationNameServer(zone_id=zone.id, name_server=ns, position=position)
            )

    # Route53 side effects: apex NS + SOA in the same transaction.
    ns_record = RecordSet(
        id=new_record_id(), zone_id=zone.id, name=name, type="NS", ttl=APEX_NS_TTL
    )
    db.add(ns_record)
    db.flush()
    for position, ns in enumerate(ns_names):
        db.add(
            ResourceRecord(record_set_id=ns_record.id, value=f"{ns}.", position=position)
        )
    soa_record = RecordSet(
        id=new_record_id(), zone_id=zone.id, name=name, type="SOA", ttl=APEX_SOA_TTL
    )
    db.add(soa_record)
    db.flush()
    db.add(
        ResourceRecord(
            record_set_id=soa_record.id,
            value=(
                f"{ns_names[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
            ),
            position=0,
        )
    )

    change = create_change(db)
    db.commit()
    db.refresh(zone)
    return zone, ns_names, change


def list_zones(
    db: Session,
    user: User,
    *,
    q: str | None = None,
    zone_type: str | None = None,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "name",
    sort_order: str = "asc",
) -> tuple[list[tuple[HostedZone, int]], int]:
    rc = (
        select(func.count(RecordSet.id))
        .where(RecordSet.zone_id == HostedZone.id)
        .correlate(HostedZone)
        .scalar_subquery()
    )
    stmt = select(HostedZone, rc.label("record_count")).where(
        HostedZone.owner_id == user.id
    )
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(HostedZone.name).like(like),
                func.lower(func.coalesce(HostedZone.comment, "")).like(like),
                func.lower(HostedZone.id).like(like),
            )
        )
    if zone_type:
        stmt = stmt.where(HostedZone.private_zone == (zone_type == "private"))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    sort_col = {
        "name": HostedZone.name,
        "record_count": rc,
        "created_at": HostedZone.created_at,
        "comment": HostedZone.comment,
    }[sort_by]
    ordered = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    stmt = stmt.order_by(ordered, HostedZone.id)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = [(zone, count) for zone, count in db.execute(stmt).all()]
    return rows, total


def zone_list_item(zone: HostedZone, count: int) -> dict:
    return {
        "id": zone.id,
        "name": zone.name,
        "private_zone": zone.private_zone,
        "comment": zone.comment,
        "record_count": count,
        "created_by": CREATED_BY,
        "created_at": zone.created_at,
        "updated_at": zone.updated_at,
    }


def zone_detail(db: Session, zone: HostedZone) -> dict:
    return {
        "id": zone.id,
        "name": zone.name,
        "caller_reference": zone.caller_reference,
        "comment": zone.comment,
        "private_zone": zone.private_zone,
        "record_count": record_count(db, zone.id),
        "name_servers": [ns.name_server for ns in zone.name_servers],
        "vpcs": [VpcIn(region=v.vpc_region, vpc_id=v.vpc_id) for v in zone.vpcs],
        "tags": [TagIn(key=t.key, value=t.value) for t in zone.tags],
        "created_by": CREATED_BY,
        "created_at": zone.created_at,
        "updated_at": zone.updated_at,
    }


def update_comment(db: Session, zone: HostedZone, comment: str | None) -> HostedZone:
    zone.comment = comment
    zone.updated_at = utcnow()
    db.commit()
    db.refresh(zone)
    return zone


def delete_zone(db: Session, zone: HostedZone) -> Change:
    extra = db.scalar(
        select(func.count())
        .select_from(RecordSet)
        .where(
            RecordSet.zone_id == zone.id,
            ~(
                (RecordSet.name == zone.name)
                & (RecordSet.type.in_(("NS", "SOA")))
            ),
        )
    )
    if extra:
        raise hosted_zone_not_empty()
    db.delete(zone)
    change = create_change(db)
    db.commit()
    return change


def batch_delete_zones(db: Session, user: User, ids: list[str]) -> list[dict]:
    results: list[dict] = []
    for zone_id in ids:
        try:
            zone = get_zone(db, user, zone_id)
            change = delete_zone(db, zone)
            results.append({"id": zone_id, "ok": True, "change_id": change.id})
        except ApiError as exc:
            db.rollback()
            results.append(
                {
                    "id": zone_id,
                    "ok": False,
                    "error": {"code": exc.code, "message": exc.message},
                }
            )
    return results
