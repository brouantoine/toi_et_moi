"""Distance between partners from their real positions, with explicit consent.

- Each person accepts the terms (versioned) before anything is read.
- Positions are sent by the app while it is open; never in the background.
- The partner sees nothing unless BOTH share; then only the rounded distance and the
  name of the nearest city. Coordinates never leave the backend.
- Stopping erases the coordinates immediately.
"""

from typing import Any

from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple

from . import cities
from .models import LocationShare

TERMS_VERSION = 1


class ConsentRequired(PermissionError):
    pass


class OutdatedTerms(ValueError):
    pass


def _share(user: User | None) -> LocationShare | None:
    if user is None:
        return None
    return LocationShare.objects.filter(user=user).first()


def _city(share: LocationShare | None) -> dict[str, str] | None:
    city = cities.get(share.city_id) if share and share.city_id else None
    return {"name": city.name, "country": city.country} if city else None


def overview(user: User, couple: Couple) -> dict[str, Any]:
    mine = _share(user)
    theirs = _share(couple.partner_of(user))
    both = bool(mine and mine.located and theirs and theirs.located)
    km: int | None = None
    if both and mine and theirs:
        assert mine.latitude is not None and mine.longitude is not None  # noqa: S101
        assert theirs.latitude is not None and theirs.longitude is not None  # noqa: S101
        km = cities.rounded_km(
            cities.km_between(mine.latitude, mine.longitude, theirs.latitude, theirs.longitude)
        )
    return {
        "terms_version": TERMS_VERSION,
        "mine": {
            "consented": bool(mine and mine.terms_version >= TERMS_VERSION),
            "sharing": bool(mine and mine.located),
            "city": _city(mine),
            "located_at": mine.located_at if mine else None,
        },
        "partner": {
            "sharing": bool(theirs and theirs.located),
            "city": _city(theirs) if both else None,
        },
        "km": km,
    }


def accept_terms(user: User, version: int) -> None:
    if version != TERMS_VERSION:
        raise OutdatedTerms(version)
    LocationShare.objects.update_or_create(
        user=user, defaults={"terms_version": version, "consented_at": timezone.now()}
    )


def update_position(user: User, couple: Couple, latitude: float, longitude: float) -> None:
    share = _share(user)
    if share is None or share.terms_version < TERMS_VERSION:
        raise ConsentRequired()
    city = cities.nearest(latitude, longitude)
    share.latitude, share.longitude = latitude, longitude
    share.city_id = city.id if city else None
    share.located_at = timezone.now()
    share.save()
    notify_changed(couple.pk, "distance", user.pk, "updated")


def stop(user: User, couple: Couple | None) -> None:
    """Withdraws consent and erases the position at once."""
    LocationShare.objects.filter(user=user).delete()
    if couple is not None:
        notify_changed(couple.pk, "distance", user.pk, "deleted")
