"""BIND zone file import/export.

Import parses with dnspython and funnels everything through
record_service.create_records so the exact same validation, CNAME-conflict,
duplicate and atomicity rules apply.
"""

import re

import dns.exception
import dns.name
import dns.rdatatype
import dns.zone
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.base import utcnow
from app.models import Change, HostedZone, RecordSet
from app.schemas.record import RecordCreate
from app.services import record_service

SUPPORTED_TYPES = {"A", "AAAA", "CNAME", "MX", "NS", "PTR", "SRV", "CAA", "TXT"}
MAX_IMPORT_RECORD_SETS = 1000
SOA_ROOT_NS_REASON = "Route 53 ignores the SOA and root NS records"
UNSUPPORTED_REASON = "Unsupported record type"


def _invalid_zone_file(message: str, line: int = 0) -> ApiError:
    return ApiError(
        "InvalidZoneFile", message, 400, [{"line": line, "message": message}]
    )


def _error_line(exc: Exception) -> int:
    """dnspython syntax errors look like '<string>:5: ...'; fall back to 0."""
    text = str(exc)
    match = re.search(r":(\d+):", text) or re.search(r"line (\d+)", text, re.I)
    return int(match.group(1)) if match else 0


def _clean_message(exc: Exception) -> str:
    """Drop the '<string>:N: ' prefix — the line number lives in the line field."""
    return re.sub(r"^<string>:\d+:\s*", "", str(exc))


def parse_zone_file(
    zone_name: str, zone_file: str
) -> tuple[list[RecordCreate], list[dict]]:
    try:
        parsed = dns.zone.from_text(
            zone_file, origin=zone_name, relativize=False, check_origin=False
        )
    except dns.exception.SyntaxError as exc:
        raise ApiError(
            "InvalidZoneFile",
            f"Zone file syntax error: {_clean_message(exc)}",
            400,
            [{"line": _error_line(exc), "message": _clean_message(exc)}],
        ) from exc
    except dns.exception.DNSException as exc:
        raise ApiError(
            "InvalidZoneFile",
            f"Could not parse the zone file: {_clean_message(exc)}",
            400,
            [{"line": _error_line(exc), "message": _clean_message(exc)}],
        ) from exc

    origin = dns.name.from_text(zone_name)
    apex = zone_name.lower()
    items: list[RecordCreate] = []
    skipped: list[dict] = []
    for name, node in parsed.nodes.items():
        if not name.is_subdomain(origin):
            raise _invalid_zone_file(
                f"Record name {name} is outside the zone {zone_name}"
            )
        fqdn = name.to_text().lower()
        for rdataset in node.rdatasets:
            rdtype = dns.rdatatype.to_text(rdataset.rdtype)
            if rdtype == "SOA" or (rdtype == "NS" and fqdn == apex):
                skipped.append(
                    {"name": fqdn, "type": rdtype, "reason": SOA_ROOT_NS_REASON}
                )
                continue
            if rdtype not in SUPPORTED_TYPES:
                skipped.append(
                    {"name": fqdn, "type": rdtype, "reason": UNSUPPORTED_REASON}
                )
                continue
            items.append(
                RecordCreate(
                    name=fqdn,
                    type=rdtype,
                    ttl=rdataset.ttl,
                    values=[rdata.to_text() for rdata in rdataset],
                )
            )
    if len(items) > MAX_IMPORT_RECORD_SETS:
        raise _invalid_zone_file(
            f"The zone file contains more than {MAX_IMPORT_RECORD_SETS} record sets."
        )
    return items, skipped


def import_zone_file(
    db: Session, zone: HostedZone, zone_file: str
) -> tuple[list[RecordSet], list[dict], Change]:
    items, skipped = parse_zone_file(zone.name, zone_file)
    # record_service batch errors already carry index/name/type/message,
    # matching the import contract — no enrichment needed.
    records, change = record_service.create_records(db, zone, items)
    return records, skipped, change


def _all_records(db: Session, zone: HostedZone) -> list[RecordSet]:
    records, _total, _total_unfiltered = record_service.list_records(
        db, zone, page=1, page_size=100_000
    )
    return records


def export_bind(db: Session, zone: HostedZone) -> str:
    entries: list[tuple] = []
    for record in _all_records(db, zone):
        if record.is_alias:
            entries.append(
                (
                    "comment",
                    f"; ALIAS {record.name} {record.type} -> {record.alias_dns_name} "
                    f"(alias_hosted_zone_id={record.alias_hosted_zone_id}, "
                    "evaluate_target_health="
                    f"{str(record.alias_evaluate_target_health).lower()})",
                )
            )
            continue
        if record.routing_policy != "SIMPLE":
            values = ", ".join(rr.value for rr in record.resource_records)
            extras = [
                f"weight={record.weight}" if record.weight is not None else "",
                f"region={record.region}" if record.region else "",
                f"failover={record.failover}" if record.failover else "",
                f"geo_continent={record.geo_continent}" if record.geo_continent else "",
                f"geo_country={record.geo_country}" if record.geo_country else "",
                (
                    f"geo_subdivision={record.geo_subdivision}"
                    if record.geo_subdivision
                    else ""
                ),
            ]
            extra = " ".join(part for part in extras if part)
            entries.append(
                (
                    "comment",
                    f"; {record.routing_policy} {record.name} {record.type} "
                    f"set_identifier={record.set_identifier} ttl={record.ttl}"
                    f"{' ' + extra if extra else ''} values=[{values}]",
                )
            )
            continue
        for rr in record.resource_records:
            entries.append(("row", record.name, str(record.ttl), record.type, rr.value))

    rows = [entry for entry in entries if entry[0] == "row"]
    name_width = max((len(row[1]) for row in rows), default=0)
    ttl_width = max((len(row[2]) for row in rows), default=0)
    type_width = max((len(row[3]) for row in rows), default=0)

    lines = [
        f"; Zone file for {zone.name}",
        f"; Exported from Route 53 Clone at {utcnow().isoformat()}Z",
        "; Alias records are exported as comments; BIND cannot represent them",
        f"$ORIGIN {zone.name}",
        "$TTL 300",
    ]
    for entry in entries:
        if entry[0] == "comment":
            lines.append(entry[1])
        else:
            _, name, ttl, rtype, value = entry
            lines.append(
                f"{name:<{name_width}} {ttl:>{ttl_width}} IN {rtype:<{type_width}} {value}"
            )
    return "\n".join(lines) + "\n"


def export_json(db: Session, zone: HostedZone) -> dict:
    """AWS CLI list-resource-record-sets shape; absent keys are omitted."""
    record_sets: list[dict] = []
    for record in _all_records(db, zone):
        entry: dict = {"Name": record.name, "Type": record.type}
        if record.ttl is not None:
            entry["TTL"] = record.ttl
        values = [rr.value for rr in record.resource_records]
        if values:
            entry["ResourceRecords"] = [{"Value": value} for value in values]
        if record.set_identifier:
            entry["SetIdentifier"] = record.set_identifier
        if record.weight is not None:
            entry["Weight"] = record.weight
        if record.region:
            entry["Region"] = record.region
        if record.failover:
            entry["Failover"] = record.failover
        geo_location = {}
        if record.geo_continent:
            geo_location["ContinentCode"] = record.geo_continent
        if record.geo_country:
            geo_location["CountryCode"] = record.geo_country
        if record.geo_subdivision:
            geo_location["SubdivisionCode"] = record.geo_subdivision
        if geo_location:
            entry["GeoLocation"] = geo_location
        if record.multivalue_answer:
            entry["MultiValueAnswer"] = True
        if record.health_check_id:
            entry["HealthCheckId"] = record.health_check_id
        if record.is_alias:
            entry["AliasTarget"] = {
                "HostedZoneId": record.alias_hosted_zone_id,
                "DNSName": record.alias_dns_name,
                "EvaluateTargetHealth": record.alias_evaluate_target_health,
            }
        record_sets.append(entry)

    config: dict = {"PrivateZone": zone.private_zone}
    if zone.comment:
        config["Comment"] = zone.comment
    return {
        "HostedZone": {
            "Id": f"/hostedzone/{zone.id}",
            "Name": zone.name,
            "Config": config,
        },
        "ResourceRecordSets": record_sets,
    }
