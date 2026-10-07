from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import (
    ApiError,
    invalid_change_batch,
    invalid_input,
    no_such_record_set,
)
from app.db.base import utcnow
from app.models import Change, HostedZone, RecordSet, ResourceRecord
from app.schemas.record import RecordCreate, RecordUpdate
from app.services import dns_validation
from app.services.change_service import create_change
from app.services.id_gen import new_record_id


def _identity_key(name: str, rtype: str, set_identifier: str | None) -> tuple:
    return (name, rtype, set_identifier or "")


def _duplicate_message(name: str, rtype: str, set_identifier: str | None) -> str:
    ident = f", set-identifier='{set_identifier}'" if set_identifier else ""
    return (
        f"Tried to create resource record set [name='{name}', type='{rtype}'{ident}] "
        "but it already exists"
    )


def _is_protected(record: RecordSet, zone: HostedZone) -> bool:
    return record.type == "SOA" or (record.type == "NS" and record.name == zone.name)


def get_record(db: Session, zone: HostedZone, record_id: str) -> RecordSet:
    record = db.get(RecordSet, record_id)
    if record is None or record.zone_id != zone.id:
        raise no_such_record_set(record_id)
    return record


def record_to_dict(record: RecordSet, zone: HostedZone) -> dict:
    return {
        "id": record.id,
        "zone_id": record.zone_id,
        "protected": _is_protected(record, zone),
        "name": record.name,
        "type": record.type,
        "ttl": record.ttl,
        "routing_policy": record.routing_policy,
        "set_identifier": record.set_identifier,
        "weight": record.weight,
        "region": record.region,
        "failover": record.failover,
        "geo_continent": record.geo_continent,
        "geo_country": record.geo_country,
        "geo_subdivision": record.geo_subdivision,
        "multivalue_answer": record.multivalue_answer,
        "health_check_id": record.health_check_id,
        "is_alias": record.is_alias,
        "alias_dns_name": record.alias_dns_name,
        "alias_hosted_zone_id": record.alias_hosted_zone_id,
        "alias_evaluate_target_health": record.alias_evaluate_target_health,
        "values": [rr.value for rr in record.resource_records],
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def list_records(
    db: Session,
    zone: HostedZone,
    *,
    q: str | None = None,
    types: str | None = None,
    routing_policy: str | None = None,
    alias: bool | None = None,
    page: int = 1,
    page_size: int = 50,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[RecordSet], int, int]:
    total_unfiltered = db.scalar(
        select(func.count()).select_from(RecordSet).where(RecordSet.zone_id == zone.id)
    )
    stmt = select(RecordSet).where(RecordSet.zone_id == zone.id)
    if q:
        like = f"%{q.lower()}%"
        value_match = exists(
            select(ResourceRecord.id).where(
                ResourceRecord.record_set_id == RecordSet.id,
                func.lower(ResourceRecord.value).like(like),
            )
        )
        stmt = stmt.where(or_(func.lower(RecordSet.name).like(like), value_match))
    if types:
        wanted = [t.strip().upper() for t in types.split(",") if t.strip()]
        if wanted:
            stmt = stmt.where(RecordSet.type.in_(wanted))
    if routing_policy:
        stmt = stmt.where(RecordSet.routing_policy == routing_policy.strip().upper())
    if alias is not None:
        stmt = stmt.where(RecordSet.is_alias == alias)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    if sort_by:
        sort_col = {
            "name": RecordSet.name,
            "type": RecordSet.type,
            "ttl": RecordSet.ttl,
            "routing_policy": RecordSet.routing_policy,
        }[sort_by]
        ordered = sort_col.desc() if sort_order == "desc" else sort_col.asc()
        stmt = stmt.order_by(ordered, RecordSet.name, RecordSet.type)
    else:
        # Route53 console default: apex first, NS then SOA, then by name, type.
        stmt = stmt.order_by(
            case((RecordSet.name == zone.name, 0), else_=1),
            case((RecordSet.type == "NS", 0), (RecordSet.type == "SOA", 1), else_=2),
            RecordSet.name,
            RecordSet.type,
        )
    stmt = (
        stmt.offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(RecordSet.resource_records))
    )
    return list(db.scalars(stmt).all()), total, total_unfiltered


def _check_conflicts(
    db: Session,
    zone: HostedZone,
    normalized: list[dict],
    *,
    exclude_record_id: str | None = None,
) -> list[dict]:
    """Duplicate-identity and CNAME-coexistence checks against the DB and the batch."""
    errors: list[dict] = []
    names = {n["name"] for n in normalized}
    existing_stmt = select(RecordSet).where(
        RecordSet.zone_id == zone.id, RecordSet.name.in_(names)
    )
    existing = [
        r for r in db.scalars(existing_stmt).all() if r.id != exclude_record_id
    ]

    def _error(index: int, message: str) -> dict:
        return {
            "index": index,
            "name": normalized[index]["name"],
            "type": normalized[index]["type"],
            "message": message,
        }

    seen: dict[tuple, int] = {}
    for i, n in enumerate(normalized):
        key = _identity_key(n["name"], n["type"], n["set_identifier"])

        if n["type"] == "SOA":
            errors.append(_error(i, "SOA record sets cannot be created."))
            continue

        if key in seen:
            errors.append(
                _error(
                    i, _duplicate_message(n["name"], n["type"], n["set_identifier"])
                )
            )
            continue
        seen[key] = i

        if any(
            _identity_key(r.name, r.type, r.set_identifier) == key for r in existing
        ):
            errors.append(
                _error(
                    i, _duplicate_message(n["name"], n["type"], n["set_identifier"])
                )
            )
            continue

        # CNAME cannot coexist with any other type at the same name (both directions).
        db_types_at_name = {r.type for r in existing if r.name == n["name"]}
        batch_types_at_name = {
            m["type"]
            for j, m in enumerate(normalized)
            if j != i and m["name"] == n["name"]
        }
        other_types = (db_types_at_name | batch_types_at_name) - {n["type"]}
        if n["type"] == "CNAME" and other_types:
            errors.append(
                _error(
                    i,
                    f"RRSet of type CNAME with DNS name {n['name']} is not "
                    "permitted because a record set of another type with the "
                    "same name already exists",
                )
            )
        elif n["type"] != "CNAME" and "CNAME" in other_types:
            errors.append(
                _error(
                    i,
                    f"RRSet of type {n['type']} with DNS name {n['name']} is not "
                    "permitted because a CNAME record set with the same name "
                    "already exists",
                )
            )
    return errors


def _raise_batch(errors: list[dict]) -> None:
    message = (
        errors[0]["message"]
        if len(errors) == 1
        else "One or more record sets in the change batch are invalid."
    )
    raise invalid_change_batch(message, errors)


def _insert_record(db: Session, zone: HostedZone, normalized: dict) -> RecordSet:
    values = normalized.pop("values")
    record = RecordSet(id=new_record_id(), zone_id=zone.id, **normalized)
    db.add(record)
    db.flush()
    for position, value in enumerate(values):
        db.add(ResourceRecord(record_set_id=record.id, value=value, position=position))
    return record


def create_records(
    db: Session, zone: HostedZone, items: list[RecordCreate]
) -> tuple[list[RecordSet], Change]:
    # Validate everything first; report per-record errors with their index.
    errors: list[dict] = []
    normalized: list[dict] = []
    for i, item in enumerate(items):
        try:
            normalized.append(
                dns_validation.validate_record_set(zone.name, item.model_dump())
            )
        except ApiError as exc:
            errors.append(
                {
                    "index": i,
                    "name": item.name,
                    "type": (item.type or "").upper(),
                    "message": exc.message,
                }
            )
    if errors:
        _raise_batch(errors)

    errors = _check_conflicts(db, zone, normalized)
    if errors:
        _raise_batch(errors)

    # All valid — insert atomically.
    records = [_insert_record(db, zone, n) for n in normalized]
    change = create_change(db)
    db.commit()
    for record in records:
        db.refresh(record)
    return records, change


def update_record(
    db: Session, zone: HostedZone, record: RecordSet, payload: RecordUpdate
) -> tuple[RecordSet, Change]:
    if payload.name is not None:
        new_name = dns_validation.normalize_record_name(payload.name, zone.name)
        if new_name != record.name:
            raise invalid_input("Record name cannot be changed.")
    if payload.type is not None and payload.type.strip().upper() != record.type:
        raise invalid_input("Record type cannot be changed.")

    data = payload.model_dump(exclude={"name", "type"})
    data["name"] = record.name
    data["type"] = record.type
    normalized = dns_validation.validate_record_set(zone.name, data)

    if record.type != "SOA":  # the apex SOA stays in place; others get conflict checks
        errors = _check_conflicts(
            db, zone, [normalized], exclude_record_id=record.id
        )
        errors = [e for e in errors if "SOA record sets" not in e["message"]]
        if errors:
            _raise_batch(errors)

    values = normalized.pop("values")
    for field, value in normalized.items():
        setattr(record, field, value)
    record.resource_records.clear()
    db.flush()
    for position, value in enumerate(values):
        db.add(ResourceRecord(record_set_id=record.id, value=value, position=position))
    record.updated_at = utcnow()
    change = create_change(db)
    db.commit()
    db.refresh(record)
    return record, change


def delete_record(db: Session, zone: HostedZone, record: RecordSet) -> Change:
    if record.type == "SOA":
        raise invalid_change_batch("The SOA record set cannot be deleted.")
    if record.type == "NS" and record.name == zone.name:
        raise invalid_change_batch("The apex NS record set cannot be deleted.")
    db.delete(record)
    change = create_change(db)
    db.commit()
    return change


def batch_delete_records(
    db: Session, zone: HostedZone, ids: list[str]
) -> tuple[list[str], Change]:
    records = {
        r.id: r
        for r in db.scalars(
            select(RecordSet).where(
                RecordSet.zone_id == zone.id, RecordSet.id.in_(ids)
            )
        ).all()
    }
    missing = [record_id for record_id in ids if record_id not in records]
    if missing:
        raise no_such_record_set(", ".join(missing))
    protected = [r for r in records.values() if _is_protected(r, zone)]
    if protected:
        names = ", ".join(f"[name='{r.name}', type='{r.type}']" for r in protected)
        raise invalid_change_batch(
            f"Batch contains protected record sets that cannot be deleted: {names}"
        )
    for record in records.values():
        db.delete(record)
    change = create_change(db)
    db.commit()
    return list(records.keys()), change
