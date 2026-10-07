"""Pure DNS validation and normalization helpers.

No DB or framework dependencies — everything raises ApiError and is unit-testable.
"""

import ipaddress
import re

from app.core.errors import ApiError, invalid_domain_name, invalid_input

RECORD_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"}
ROUTING_POLICIES = {
    "SIMPLE",
    "WEIGHTED",
    "LATENCY",
    "FAILOVER",
    "GEOLOCATION",
    "MULTIVALUE",
    "IP_BASED",
}
MULTIVALUE_TYPES = {"A", "AAAA", "TXT", "MX", "PTR", "SRV", "CAA"}
ALIAS_TYPES = {"A", "AAAA", "CNAME"}
CAA_TAGS = {"issue", "issuewild", "iodef"}
FAILOVER_VALUES = {"PRIMARY", "SECONDARY"}
MAX_TTL = 2_147_483_647
DEFAULT_TTL = 300

_LABEL_RE = re.compile(r"^[a-z0-9_-]{1,63}$")
_HOST_LABEL_RE = re.compile(r"^[a-z0-9_-]{1,63}$", re.IGNORECASE)
_TXT_CHUNK_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')
_CAA_RE = re.compile(r"^(\d{1,3})\s+([a-zA-Z]+)\s+(.+)$")


def normalize_name(name: str) -> str:
    """Lowercase + trailing dot. No validation."""
    name = name.strip().lower()
    if not name.endswith("."):
        name += "."
    return name


def validate_fqdn(name: str, *, allow_wildcard: bool = False) -> str:
    fqdn = normalize_name(name)
    if fqdn == ".":
        raise invalid_domain_name("Domain name must not be empty.")
    if len(fqdn) > 255:
        raise invalid_domain_name(f"Domain name is too long: {fqdn}")
    labels = fqdn[:-1].split(".")
    for i, label in enumerate(labels):
        if label == "*":
            if not (allow_wildcard and i == 0):
                raise invalid_domain_name(
                    "'*' is only allowed as the leftmost whole label."
                )
            continue
        if "*" in label:
            raise invalid_domain_name("'*' must be used as a whole label.")
        if not _LABEL_RE.match(label):
            raise invalid_domain_name(f"Invalid label '{label}' in domain name '{fqdn}'.")
    return fqdn


def normalize_zone_name(name: str) -> str:
    return validate_fqdn(name, allow_wildcard=False)


def normalize_record_name(name: str, zone_name: str) -> str:
    """Accept relative names ('www'), '@'/'' for apex, or FQDNs inside the zone."""
    zone = normalize_name(zone_name)
    raw = (name or "").strip()
    if raw in ("", "@"):
        fqdn = zone
    else:
        candidate = normalize_name(raw)
        if candidate == zone or candidate.endswith("." + zone):
            fqdn = candidate
        elif raw.endswith("."):
            fqdn = candidate  # absolute name outside the zone — fails containment below
        else:
            fqdn = normalize_name(raw + "." + zone[:-1])
    fqdn = validate_fqdn(fqdn, allow_wildcard=True)
    if fqdn != zone and not fqdn.endswith("." + zone):
        raise invalid_domain_name(
            f"RRSet with DNS name {fqdn} is not permitted in zone {zone}"
        )
    return fqdn


def validate_ttl(ttl: int | None) -> int:
    if ttl is None:
        return DEFAULT_TTL
    if isinstance(ttl, bool) or not isinstance(ttl, int) or ttl < 0 or ttl > MAX_TTL:
        raise invalid_input(f"TTL must be an integer between 0 and {MAX_TTL}.")
    return ttl


def validate_hostname(value: str, what: str = "domain name") -> None:
    v = value.strip()
    if not v or len(v) > 255:
        raise invalid_input(f"Invalid {what}: '{value}'")
    if v.endswith("."):
        v = v[:-1]
    for label in v.split("."):
        if not _HOST_LABEL_RE.match(label):
            raise invalid_input(f"Invalid {what}: '{value}'")


def _validate_int_field(raw: str, what: str, low: int, high: int) -> int:
    try:
        n = int(raw)
    except ValueError:
        raise invalid_input(f"{what} must be an integer between {low} and {high}.") from None
    if n < low or n > high:
        raise invalid_input(f"{what} must be an integer between {low} and {high}.")
    return n


def _normalize_txt_value(value: str) -> str:
    s = value.strip()
    if s.startswith('"'):
        pos = 0
        chunks: list[str] = []
        while pos < len(s):
            m = _TXT_CHUNK_RE.match(s, pos)
            if not m:
                raise invalid_input(
                    "TXT record values must be one or more double-quoted strings."
                )
            chunks.append(m.group(1))
            pos = m.end()
            while pos < len(s) and s[pos] == " ":
                pos += 1
        for chunk in chunks:
            unescaped = chunk.replace('\\"', '"').replace("\\\\", "\\")
            if len(unescaped) > 255:
                raise invalid_input(
                    "Each quoted TXT string must be at most 255 characters."
                )
        return s
    if len(s) > 255:
        raise invalid_input("Each quoted TXT string must be at most 255 characters.")
    escaped = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _validate_caa_value(value: str) -> str:
    m = _CAA_RE.match(value.strip())
    if not m:
        raise invalid_input(f"CAA value must be 'flags tag \"value\"': '{value}'")
    flags = _validate_int_field(m.group(1), "CAA flags", 0, 255)
    tag = m.group(2).lower()
    if tag not in CAA_TAGS:
        raise invalid_input(f"CAA tag must be one of {sorted(CAA_TAGS)}: '{value}'")
    rest = m.group(3).strip()
    if not (rest.startswith('"') and rest.endswith('"') and len(rest) >= 2):
        rest = '"' + rest.replace('"', '\\"') + '"'
    return f"{flags} {tag} {rest}"


def _validate_soa_value(value: str) -> str:
    fields = value.split()
    if len(fields) != 7:
        raise invalid_input(
            "SOA value must have 7 fields: 'mname rname serial refresh retry expire minimum'."
        )
    validate_hostname(fields[0], "SOA mname")
    validate_hostname(fields[1], "SOA rname")
    for i, what in enumerate(
        ("serial", "refresh", "retry", "expire", "minimum"), start=2
    ):
        _validate_int_field(fields[i], f"SOA {what}", 0, MAX_TTL)
    return " ".join(fields)


def validate_record_values(rtype: str, values: list[str]) -> list[str]:
    if not values:
        raise invalid_input(f"{rtype} records require at least one value.")
    stripped = [str(v).strip() for v in values]
    if rtype != "TXT" and any(not v for v in stripped):
        raise invalid_input("Record values must not be empty.")

    if rtype == "A":
        for v in stripped:
            try:
                ipaddress.IPv4Address(v)
            except ValueError:
                raise invalid_input(f"Invalid IPv4 address: '{v}'") from None
        return stripped
    if rtype == "AAAA":
        for v in stripped:
            try:
                ipaddress.IPv6Address(v)
            except ValueError:
                raise invalid_input(f"Invalid IPv6 address: '{v}'") from None
        return stripped
    if rtype == "CNAME":
        if len(stripped) != 1:
            raise invalid_input("A CNAME record set must contain exactly one value.")
        validate_hostname(stripped[0], "CNAME value")
        return stripped
    if rtype == "TXT":
        return [_normalize_txt_value(v) for v in stripped]
    if rtype == "MX":
        out = []
        for v in stripped:
            parts = v.split(None, 1)
            if len(parts) != 2:
                raise invalid_input(f"MX value must be 'priority hostname': '{v}'")
            prio = _validate_int_field(parts[0], "MX priority", 0, 65535)
            validate_hostname(parts[1], "MX hostname")
            out.append(f"{prio} {parts[1]}")
        return out
    if rtype in ("NS", "PTR"):
        for v in stripped:
            validate_hostname(v, f"{rtype} value")
        return stripped
    if rtype == "SRV":
        out = []
        for v in stripped:
            parts = v.split()
            if len(parts) != 4:
                raise invalid_input(
                    f"SRV value must be 'priority weight port target': '{v}'"
                )
            nums = [
                _validate_int_field(parts[i], f"SRV {what}", 0, 65535)
                for i, what in enumerate(("priority", "weight", "port"))
            ]
            validate_hostname(parts[3], "SRV target")
            out.append(f"{nums[0]} {nums[1]} {nums[2]} {parts[3]}")
        return out
    if rtype == "CAA":
        return [_validate_caa_value(v) for v in stripped]
    if rtype == "SOA":
        if len(stripped) != 1:
            raise invalid_input("An SOA record set must contain exactly one value.")
        return [_validate_soa_value(stripped[0])]
    raise invalid_input(f"Unsupported record type: {rtype}")


def validate_routing(
    rtype: str,
    policy: str,
    set_identifier: str | None,
    weight: int | None,
    region: str | None,
    failover: str | None,
    geo_continent: str | None,
    geo_country: str | None,
    geo_subdivision: str | None,
) -> None:
    if policy not in ROUTING_POLICIES:
        raise invalid_input(f"Unsupported routing policy: {policy}")
    if policy == "SIMPLE":
        if set_identifier:
            raise invalid_input("set_identifier is not allowed for SIMPLE routing.")
        return
    if rtype in ("SOA", "NS") and policy != "SIMPLE":
        raise invalid_input(f"{rtype} record sets only support SIMPLE routing.")
    if not set_identifier or not set_identifier.strip():
        raise invalid_input(f"set_identifier is required for {policy} routing.")
    if policy == "WEIGHTED":
        if weight is None:
            raise invalid_input("weight is required for WEIGHTED routing.")
        if isinstance(weight, bool) or not isinstance(weight, int) or not 0 <= weight <= 255:
            raise invalid_input("weight must be an integer between 0 and 255.")
    elif policy == "LATENCY":
        if not region or not region.strip():
            raise invalid_input("region is required for LATENCY routing.")
    elif policy == "FAILOVER":
        if failover not in FAILOVER_VALUES:
            raise invalid_input("failover must be PRIMARY or SECONDARY.")
    elif policy == "GEOLOCATION":
        if not (geo_continent or geo_country or geo_subdivision):
            raise invalid_input(
                "GEOLOCATION routing requires at least one of geo_continent, "
                "geo_country or geo_subdivision."
            )
    elif policy == "MULTIVALUE":
        if rtype not in MULTIVALUE_TYPES:
            raise invalid_input(
                f"Multivalue answer routing is not supported for type {rtype}."
            )


def validate_record_set(zone_name: str, data: dict) -> dict:
    """Validate and normalize one record set payload.

    Returns a dict with RecordSet column values plus 'values'.
    """
    rtype = (data.get("type") or "").strip().upper()
    if rtype not in RECORD_TYPES:
        raise invalid_input(f"Unsupported record type: {data.get('type')!r}")
    zone = normalize_name(zone_name)
    name = normalize_record_name(data.get("name") or "", zone)
    if rtype == "CNAME" and name == zone:
        raise ApiError(
            "InvalidChangeBatch",
            f"RRSet of type CNAME with DNS name {name} is not permitted at apex "
            f"in zone {zone}",
            400,
        )

    policy = (data.get("routing_policy") or "SIMPLE").strip().upper()
    set_identifier = data.get("set_identifier")
    validate_routing(
        rtype,
        policy,
        set_identifier,
        data.get("weight"),
        data.get("region"),
        data.get("failover"),
        data.get("geo_continent"),
        data.get("geo_country"),
        data.get("geo_subdivision"),
    )

    out: dict = {
        "name": name,
        "type": rtype,
        "routing_policy": policy,
        "set_identifier": set_identifier if policy != "SIMPLE" else None,
        "weight": data.get("weight") if policy == "WEIGHTED" else None,
        "region": data.get("region") if policy == "LATENCY" else None,
        "failover": data.get("failover") if policy == "FAILOVER" else None,
        "geo_continent": data.get("geo_continent") if policy == "GEOLOCATION" else None,
        "geo_country": data.get("geo_country") if policy == "GEOLOCATION" else None,
        "geo_subdivision": data.get("geo_subdivision") if policy == "GEOLOCATION" else None,
        "multivalue_answer": policy == "MULTIVALUE",
        "health_check_id": data.get("health_check_id"),
        "is_alias": bool(data.get("is_alias")),
    }

    if out["is_alias"]:
        if rtype not in ALIAS_TYPES:
            raise invalid_input("Alias is only supported for A, AAAA and CNAME records.")
        if data.get("ttl") is not None:
            raise invalid_input("TTL is not allowed for alias records.")
        if data.get("values"):
            raise invalid_input("Alias records cannot have values.")
        dns_name = (data.get("alias_dns_name") or "").strip()
        hz_id = (data.get("alias_hosted_zone_id") or "").strip()
        if not dns_name or not hz_id:
            raise invalid_input(
                "alias_dns_name and alias_hosted_zone_id are required for alias records."
            )
        validate_hostname(dns_name, "alias target")
        out.update(
            ttl=None,
            values=[],
            alias_dns_name=normalize_name(dns_name),
            alias_hosted_zone_id=hz_id,
            alias_evaluate_target_health=bool(data.get("alias_evaluate_target_health")),
        )
    else:
        out.update(
            ttl=validate_ttl(data.get("ttl")),
            values=validate_record_values(rtype, data.get("values") or []),
            alias_dns_name=None,
            alias_hosted_zone_id=None,
            alias_evaluate_target_health=False,
        )
    return out
