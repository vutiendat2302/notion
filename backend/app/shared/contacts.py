import re

from app.core.exceptions import ValidationAppError

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}[a-zA-Z0-9]$")
_PHONE_STRIP_RE = re.compile(r"[\s.\-()]+")
_VN_LOCAL_MOBILE_RE = re.compile(r"^0[35789][0-9]{8}$")
_VN_INTL_MOBILE_RE = re.compile(r"^84[35789][0-9]{8}$")
_E164_RE = re.compile(r"^\+[1-9][0-9]{7,14}$")


def normalize_email(raw_email: str | None) -> tuple[str | None, str | None]:
    """Validate and normalize an optional email address."""
    if raw_email is None:
        return None, None
    cleaned = raw_email.strip()
    if not cleaned:
        return None, None

    if (
        len(cleaned) > 254
        or not _EMAIL_RE.match(cleaned)
        or ".." in cleaned
        or cleaned.startswith(".")
        or "@." in cleaned
        or ".@" in cleaned
    ):
        raise ValidationAppError("Email không đúng định dạng.", code="INVALID_EMAIL")
    return cleaned, cleaned.casefold()


def normalize_phone(raw_phone: str | None) -> tuple[str | None, str | None]:
    """Validate and normalize an optional phone number to E.164 (+84... for VN numbers)."""
    if raw_phone is None:
        return None, None
    cleaned = _PHONE_STRIP_RE.sub("", raw_phone.strip())
    if not cleaned:
        return None, None

    if cleaned.startswith("00"):
        candidate = f"+{cleaned[2:]}"
        if not _E164_RE.match(candidate):
            raise ValidationAppError(
                "Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678).",
                code="INVALID_PHONE",
            )
        normalized = candidate
    elif cleaned.startswith("+84"):
        if not re.match(r"^\+84[35789][0-9]{8}$", cleaned):
            raise ValidationAppError(
                "Số điện thoại Việt Nam không hợp lệ (ví dụ: +84912345678).",
                code="INVALID_PHONE",
            )
        normalized = cleaned
    elif cleaned.startswith("+"):
        if not _E164_RE.match(cleaned):
            raise ValidationAppError(
                "Số điện thoại quốc tế không hợp lệ (ví dụ: +84912345678).",
                code="INVALID_PHONE",
            )
        normalized = cleaned
    elif _VN_LOCAL_MOBILE_RE.match(cleaned):
        normalized = f"+84{cleaned[1:]}"
    elif _VN_INTL_MOBILE_RE.match(cleaned):
        normalized = f"+{cleaned}"
    else:
        raise ValidationAppError(
            "Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678).",
            code="INVALID_PHONE",
        )

    return cleaned, normalized


def normalize_username(raw_username: str | None) -> tuple[str | None, str | None]:
    """Validate and normalize an optional unique username."""
    if raw_username is None:
        return None, None
    cleaned = raw_username.strip()
    if not cleaned:
        return None, None

    if (
        len(cleaned) < 3
        or len(cleaned) > 50
        or "@" in cleaned
        or ".." in cleaned
        or cleaned.isdigit()
        or not _USERNAME_RE.match(cleaned)
    ):
        raise ValidationAppError(
            "Tên tài khoản dài 3–50 ký tự, chỉ gồm chữ, số, '.', '_', '-' và không chỉ gồm số.",
            code="INVALID_USERNAME",
        )
    return cleaned, cleaned.casefold()


def looks_like_email(identifier: str) -> bool:
    return "@" in identifier


def looks_like_phone(identifier: str) -> bool:
    stripped = _PHONE_STRIP_RE.sub("", identifier.strip())
    if not stripped:
        return False
    if stripped.startswith("+") and len(stripped) > 1 and stripped[1:].isdigit():
        return True
    return stripped.isdigit() and len(stripped) >= 8
