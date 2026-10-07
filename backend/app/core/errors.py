from typing import Any


class ApiError(Exception):
    """Application error rendered as the Route53-style error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def invalid_input(message: str, details: list[Any] | None = None) -> ApiError:
    return ApiError("InvalidInput", message, 400, details)


def invalid_change_batch(message: str, details: list[Any] | None = None) -> ApiError:
    return ApiError("InvalidChangeBatch", message, 400, details)


def invalid_domain_name(message: str) -> ApiError:
    return ApiError("InvalidDomainName", message, 400)


def no_such_hosted_zone(zone_id: str) -> ApiError:
    return ApiError("NoSuchHostedZone", f"No hosted zone found with ID: {zone_id}", 404)


def no_such_record_set(record_id: str) -> ApiError:
    return ApiError("NoSuchRecordSet", f"No record set found with ID: {record_id}", 404)


def no_such_change(change_id: str) -> ApiError:
    return ApiError("NoSuchChange", f"No change found with ID: {change_id}", 404)


def hosted_zone_not_empty() -> ApiError:
    return ApiError(
        "HostedZoneNotEmpty",
        "The hosted zone contains non-required resource record sets and so cannot be deleted.",
        400,
    )


def too_many_tag_keys() -> ApiError:
    return ApiError("TooManyTagKeys", "A hosted zone can have at most 50 tags.", 400)


def access_denied(message: str = "Access denied.") -> ApiError:
    return ApiError("AccessDenied", message, 403)


def not_authenticated(message: str = "Not authenticated.") -> ApiError:
    return ApiError("NotAuthenticated", message, 401)
