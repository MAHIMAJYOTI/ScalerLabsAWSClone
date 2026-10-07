"""Idempotent demo-data seeder, optimized for slow disks/CPUs.

Run with: `python -m scripts.seed` (add --no-with-filler to skip filler zones).

Performance contract (free-tier deploys):
- the demo user lands in its own FAST first commit so login works immediately
- everything else (zones, NS/SOA, records) is built in memory and written in
  ONE transaction with ONE commit — no per-zone commits, no per-row flushes
- idempotency is a single query over existing caller_references
"""

import argparse
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    DelegationNameServer,
    HostedZone,
    HostedZoneTag,
    HostedZoneVpc,
    RecordSet,
    ResourceRecord,
    User,
)
from app.services import dns_validation
from app.services.hosted_zone_service import (
    APEX_NS_TTL,
    APEX_SOA_TTL,
    PRIVATE_NAME_SERVERS,
)
from app.services.id_gen import generate_name_servers, new_record_id, new_zone_id

EXAMPLE_COM_RECORDS = [
    {"name": "", "type": "A", "ttl": 300, "values": ["192.0.2.10", "192.0.2.11"]},
    {"name": "www", "type": "CNAME", "ttl": 300, "values": ["example.com."]},
    {"name": "ipv6", "type": "AAAA", "ttl": 300, "values": ["2001:db8::1"]},
    {
        "name": "",
        "type": "MX",
        "ttl": 3600,
        "values": ["10 mail1.example.com.", "20 mail2.example.com."],
    },
    {"name": "", "type": "TXT", "ttl": 300, "values": ["v=spf1 include:_spf.example.com ~all"]},
    {"name": "_dmarc", "type": "TXT", "ttl": 300, "values": ["v=DMARC1; p=none;"]},
    {"name": "", "type": "CAA", "ttl": 300, "values": ['0 issue "letsencrypt.org"']},
    {
        "name": "_sip._tcp",
        "type": "SRV",
        "ttl": 300,
        "values": ["10 5 5060 sip.example.com."],
    },
    {
        "name": "api",
        "type": "A",
        "ttl": 60,
        "values": ["192.0.2.20"],
        "routing_policy": "WEIGHTED",
        "set_identifier": "api-primary",
        "weight": 70,
    },
    {
        "name": "api",
        "type": "A",
        "ttl": 60,
        "values": ["192.0.2.21"],
        "routing_policy": "WEIGHTED",
        "set_identifier": "api-secondary",
        "weight": 30,
    },
    {
        "name": "cdn",
        "type": "A",
        "is_alias": True,
        "alias_dns_name": "d111111abcdef8.cloudfront.net.",
        "alias_hosted_zone_id": "Z2FDTNDATAQYW2",
        "alias_evaluate_target_health": False,
    },
]

INTERNAL_CORP_RECORDS = [
    {"name": "db", "type": "A", "ttl": 300, "values": ["10.0.1.5"]},
    {"name": "cache", "type": "A", "ttl": 300, "values": ["10.0.1.6"]},
    {"name": "5.1.0.10", "type": "PTR", "ttl": 300, "values": ["db.internal.corp."]},
]

ACME_STAGING_RECORDS = [
    {"name": "", "type": "A", "ttl": 300, "values": ["198.51.100.7"]},
    {"name": "app", "type": "CNAME", "ttl": 300, "values": ["acme-staging.io."]},
    {"name": "", "type": "TXT", "ttl": 300, "values": ["staging environment"]},
]


def _ensure_user(
    db: Session, username: str, password: str, account_id: str, display_name: str
) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is not None:
        return user
    user = User(
        username=username,
        password_hash=hash_password(password),
        account_id=account_id,
        display_name=display_name,
    )
    db.add(user)
    return user


def ensure_users(db: Session) -> User:
    """Fast first commit: the demo user must exist before the app serves login."""
    settings = get_settings()
    user = _ensure_user(
        db,
        settings.DEMO_USERNAME,
        settings.DEMO_PASSWORD,
        settings.DEMO_ACCOUNT_ID,
        settings.DEMO_DISPLAY_NAME,
    )
    if settings.SEED_SECOND_USER:
        # Fixed second account for e2e isolation tests (no zones of its own).
        _ensure_user(db, "demo2", "route53demo2", "210987654321", "demo2-user")
    db.commit()
    return user


def _record_defaults() -> dict:
    return {
        "ttl": None,
        "values": None,
        "routing_policy": "SIMPLE",
        "set_identifier": None,
        "weight": None,
        "region": None,
        "failover": None,
        "geo_continent": None,
        "geo_country": None,
        "geo_subdivision": None,
        "health_check_id": None,
        "is_alias": False,
        "alias_dns_name": None,
        "alias_hosted_zone_id": None,
        "alias_evaluate_target_health": False,
    }


def _build_zone(
    db: Session,
    user: User,
    *,
    ref: str,
    name: str,
    comment: str | None = None,
    private_zone: bool = False,
    vpcs: list[tuple[str, str]] = (),
    tags: list[tuple[str, str]] = (),
    records: list[dict] = (),
) -> None:
    """Stage one zone (apex NS/SOA + records) on the session without flushing."""
    zone_name = dns_validation.normalize_zone_name(name)
    zone = HostedZone(
        id=new_zone_id(),
        owner_id=user.id,
        name=zone_name,
        caller_reference=ref,
        comment=comment,
        private_zone=private_zone,
    )
    db.add(zone)
    for region, vpc_id in vpcs:
        db.add(HostedZoneVpc(zone_id=zone.id, vpc_region=region, vpc_id=vpc_id))
    for key, value in tags:
        db.add(HostedZoneTag(zone_id=zone.id, key=key, value=value))

    if private_zone:
        ns_names = list(PRIVATE_NAME_SERVERS)
    else:
        ns_names = generate_name_servers()
        for position, ns in enumerate(ns_names):
            db.add(
                DelegationNameServer(zone_id=zone.id, name_server=ns, position=position)
            )

    ns_record = RecordSet(
        id=new_record_id(), zone_id=zone.id, name=zone_name, type="NS", ttl=APEX_NS_TTL
    )
    db.add(ns_record)
    for position, ns in enumerate(ns_names):
        db.add(
            ResourceRecord(record_set_id=ns_record.id, value=f"{ns}.", position=position)
        )
    soa_record = RecordSet(
        id=new_record_id(), zone_id=zone.id, name=zone_name, type="SOA", ttl=APEX_SOA_TTL
    )
    db.add(soa_record)
    db.add(
        ResourceRecord(
            record_set_id=soa_record.id,
            value=f"{ns_names[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
            position=0,
        )
    )

    for raw in records:
        normalized = dns_validation.validate_record_set(
            zone_name, {**_record_defaults(), **raw}
        )
        values = normalized.pop("values")
        record = RecordSet(id=new_record_id(), zone_id=zone.id, **normalized)
        db.add(record)
        for position, value in enumerate(values):
            db.add(
                ResourceRecord(record_set_id=record.id, value=value, position=position)
            )


def _private_zone_needs_refresh(db: Session, zone: HostedZone) -> bool:
    """True when a seeded private zone predates the fixed placeholder NS set."""
    apex_ns = db.scalar(
        select(RecordSet).where(
            RecordSet.zone_id == zone.id,
            RecordSet.type == "NS",
            RecordSet.name == zone.name,
        )
    )
    if apex_ns is None:
        return True
    expected = [f"{ns}." for ns in PRIVATE_NAME_SERVERS]
    return [rr.value for rr in apex_ns.resource_records] != expected


def seed(with_filler: bool = True) -> None:
    total_start = time.perf_counter()
    db = SessionLocal()
    try:
        phase_start = time.perf_counter()
        user = ensure_users(db)
        print(f"[seed] users ready in {time.perf_counter() - phase_start:.2f}s")

        phase_start = time.perf_counter()
        existing_refs = set(
            db.scalars(
                select(HostedZone.caller_reference).where(
                    HostedZone.owner_id == user.id
                )
            )
        )
        # Seed-owned private zones are dropped and rebuilt when their NS set
        # predates the fixed placeholder set; user zones are never touched.
        stale_private = db.scalar(
            select(HostedZone).where(
                HostedZone.owner_id == user.id,
                HostedZone.caller_reference == "seed-internal-corp",
            )
        )
        if stale_private is not None and _private_zone_needs_refresh(db, stale_private):
            db.delete(stale_private)
            existing_refs.discard("seed-internal-corp")
            print(f"[seed] refreshing private zone {stale_private.id}")
        print(f"[seed] idempotency check in {time.perf_counter() - phase_start:.2f}s")

        phase_start = time.perf_counter()
        planned: list[dict] = [
            {
                "ref": "seed-example-com-1",
                "name": "example.com",
                "comment": "Primary production zone",
                "tags": [("env", "prod"), ("team", "platform")],
                "records": EXAMPLE_COM_RECORDS,
            },
            {
                "ref": "seed-internal-corp",
                "name": "internal.corp",
                "comment": "Private corp zone",
                "private_zone": True,
                "vpcs": [("us-east-1", "vpc-0a1b2c3d4e5f67890")],
                "records": INTERNAL_CORP_RECORDS,
            },
            {
                "ref": "seed-acme-staging",
                "name": "acme-staging.io",
                "comment": "Staging zone",
                "records": ACME_STAGING_RECORDS,
            },
            # Route53 allows duplicate zone names — prove it.
            {
                "ref": "seed-example-com-2",
                "name": "example.com",
                "comment": "Duplicate-name zone (Route53 allows this)",
                "records": [
                    {"name": "", "type": "A", "ttl": 300, "values": ["203.0.113.99"]}
                ],
            },
        ]
        if with_filler:
            planned.extend(
                {
                    "ref": f"seed-filler-{i:02d}",
                    "name": f"app-{i:02d}.dev",
                    "comment": f"Filler zone #{i:02d}",
                    "records": [
                        {"name": "", "type": "A", "ttl": 300, "values": [f"192.0.2.{100 + i}"]}
                    ],
                }
                for i in range(1, 21)
            )

        created = 0
        for plan in planned:
            if plan["ref"] in existing_refs:
                continue
            _build_zone(db, user, **plan)
            created += 1
        print(
            f"[seed] staged {created} zone(s) in {time.perf_counter() - phase_start:.2f}s"
        )

        phase_start = time.perf_counter()
        db.commit()  # the single data commit
        print(f"[seed] commit in {time.perf_counter() - phase_start:.2f}s")
        print(
            f"seed complete: {created} zone(s) created (existing ones skipped) "
            f"in {time.perf_counter() - total_start:.2f}s total"
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data (idempotent).")
    parser.add_argument(
        "--with-filler",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Create ~20 filler zones for pagination (default: on).",
    )
    args = parser.parse_args()
    seed(with_filler=args.with_filler)


if __name__ == "__main__":
    main()
