"""Distance and map between partners from their real positions, with explicit consent.

- Each person accepts the terms (versioned) before anything is read. Version 2 says the
  partner sees the position on a map.
- Positions are sent by the app while it is open; never in the background.
- The partner sees nothing unless BOTH share; then the distance, the nearest city and
  the last shared position (for the map). Nobody else ever does.
- Stopping erases the coordinates immediately.
- "Continuous sharing" (app closed) is a separate opt-in, reminded every 30 days.
- Under 1 km, both phones are told once ("near"), re-armed beyond 2 km.
"""

from datetime import timedelta
from typing import Any

from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import cities, messages
from .models import LocationShare, Proximity

TERMS_VERSION = 3
NEAR_KM = 1.0
#: Hysteresis: "near" is only re-armed once you are clearly apart again.
FAR_KM = 2.0
ALERT_MIN_INTERVAL = timedelta(hours=3)
#: A position older than this says nothing about where someone is now.
FRESH_FOR = timedelta(hours=24)
REMIND_EVERY = timedelta(days=30)


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


def _position(share: LocationShare | None) -> dict[str, Any] | None:
    if share is None or not share.located:
        return None
    return {
        "latitude": share.latitude,
        "longitude": share.longitude,
        "located_at": share.located_at,
    }


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
            "position": _position(mine),
            "continuous": bool(mine and mine.continuous),
        },
        "partner": {
            "sharing": bool(theirs and theirs.located),
            "continuous": bool(both and theirs and theirs.continuous),
            "city": _city(theirs) if both else None,
            "position": _position(theirs) if both else None,
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
    _check_proximity(user, couple, share)


def _check_proximity(user: User, couple: Couple, mine: LocationShare) -> None:
    """Under 1 km: both phones vibrate, once, until you have been clearly apart again."""
    partner = couple.partner_of(user)
    theirs = _share(partner)
    if partner is None or theirs is None or not theirs.located or not mine.located:
        return
    now = timezone.now()
    if theirs.located_at is None or now - theirs.located_at > FRESH_FOR:
        return
    assert mine.latitude is not None and mine.longitude is not None  # noqa: S101
    assert theirs.latitude is not None and theirs.longitude is not None  # noqa: S101
    km = cities.km_between(mine.latitude, mine.longitude, theirs.latitude, theirs.longitude)
    state, _ = Proximity.objects.get_or_create(couple=couple)
    if km >= FAR_KM:
        if state.near:
            state.near = False
            state.save(update_fields=["near"])
        return
    if km >= NEAR_KM or state.near:
        return
    state.near = True
    recently = state.alerted_at is not None and now - state.alerted_at < ALERT_MIN_INTERVAL
    if not recently:
        state.alerted_at = now
    state.save()
    if recently:
        return
    # In-app vibration for open apps; push (which vibrates) for closed ones.
    notify_changed(couple.pk, "distance", 0, "near")
    for person, other in ((user, partner), (partner, user)):
        discreet = preference_for(person).discreet
        notify(
            person,
            Kind.PROXIMITY,
            messages.text(
                person.language,
                "near_discreet_title" if discreet else "near_title",
                name=other.display_name,
            ),
            messages.text(person.language, "near_discreet_body" if discreet else "near_body"),
            {"screen": "distance"},
        )


def set_continuous(user: User, couple: Couple, enabled: bool) -> None:
    """Opt in (or out) of sharing while the app is closed. Needs the current terms."""
    share = _share(user)
    if share is None or share.terms_version < TERMS_VERSION:
        raise ConsentRequired()
    share.continuous = enabled
    share.continuous_since = timezone.now() if enabled else None
    share.reminded_at = None
    share.save(update_fields=["continuous", "continuous_since", "reminded_at"])
    notify_changed(couple.pk, "distance", user.pk, "updated")


def send_continuous_reminders() -> int:
    """Every 30 days, tells people who share continuously that they still do."""
    from couples.services import get_active_couple

    now = timezone.now()
    sent = 0
    for share in LocationShare.objects.filter(continuous=True).select_related("user"):
        last = share.reminded_at or share.continuous_since or now
        if now - last < REMIND_EVERY:
            continue
        couple = get_active_couple(share.user)
        partner = couple.partner_of(share.user) if couple else None
        if partner is None:
            continue
        notify(
            share.user,
            Kind.PROXIMITY,
            messages.text(share.user.language, "reminder_title"),
            messages.text(share.user.language, "reminder_body", name=partner.display_name),
            {"screen": "distance"},
        )
        share.reminded_at = now
        share.save(update_fields=["reminded_at"])
        sent += 1
    return sent


def stop(user: User, couple: Couple | None) -> None:
    """Withdraws consent and erases the position at once."""
    LocationShare.objects.filter(user=user).delete()
    if couple is not None:
        Proximity.objects.filter(couple=couple).update(near=False)
        notify_changed(couple.pk, "distance", user.pk, "deleted")
