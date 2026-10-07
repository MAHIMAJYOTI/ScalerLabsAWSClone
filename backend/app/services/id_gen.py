import secrets
import string
import uuid

_UPPER_ALNUM = string.ascii_uppercase + string.digits
_LOWER_ALNUM = string.ascii_lowercase + string.digits


def _random_string(alphabet: str, length: int) -> str:
    return "".join(secrets.choice(alphabet) for _ in range(length))


def new_zone_id() -> str:
    return "Z" + _random_string(_UPPER_ALNUM, 20)


def new_change_id() -> str:
    return "C" + _random_string(_UPPER_ALNUM, 20)


def new_record_id() -> str:
    return "r" + _random_string(_LOWER_ALNUM, 13)


def new_caller_reference() -> str:
    return str(uuid.uuid4())


def generate_name_servers() -> list[str]:
    """Four Route53-style delegation name servers, one per TLD (no trailing dots)."""
    tlds = ["com", "net", "org", "co.uk"]
    return [
        f"ns-{secrets.randbelow(2048)}.awsdns-{secrets.randbelow(100):02d}.{tld}"
        for tld in tlds
    ]
