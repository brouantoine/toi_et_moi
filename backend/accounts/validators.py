from zoneinfo import available_timezones

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_TIMEZONES = frozenset(available_timezones())


def validate_timezone(value: str) -> None:
    """Accept only IANA time zone names (e.g. Europe/Paris)."""
    if value not in _TIMEZONES:
        raise ValidationError(_("Fuseau horaire inconnu."), code="invalid_timezone")
