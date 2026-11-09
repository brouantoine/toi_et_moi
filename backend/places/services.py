"""Distance between partners: each one chooses a city and turns sharing on.

Nothing about the partner is revealed unless BOTH share: the partner's city label and
the rounded distance only appear when the two of them have opted in.
"""

from typing import Any

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple

from . import cities
from .models import HomeCity


class UnknownCity(ValueError):
    pass


def _city_payload(home: HomeCity) -> dict[str, Any]:
    city = cities.get(home.city_id)
    return {"id": home.city_id, "name": home.label, "country": city.country if city else ""}


def _home(user: User | None) -> HomeCity | None:
    if user is None:
        return None
    return HomeCity.objects.filter(user=user).first()


def overview(user: User, couple: Couple) -> dict[str, Any]:
    mine = _home(user)
    theirs = _home(couple.partner_of(user))
    both = bool(mine and mine.sharing and theirs and theirs.sharing)
    km: int | None = None
    if both and mine and theirs:
        a, b = cities.get(mine.city_id), cities.get(theirs.city_id)
        if a and b:
            km = cities.rounded_km(cities.distance_km(a, b))
    return {
        "mine": {
            "city": _city_payload(mine) if mine else None,
            "sharing": bool(mine and mine.sharing),
        },
        "partner": {
            "sharing": bool(theirs and theirs.sharing),
            "city": _city_payload(theirs) if both and theirs else None,
        },
        "km": km,
    }


def set_home(
    user: User, couple: Couple, city_id: int | None, label: str | None, sharing: bool
) -> None:
    if city_id is None:
        HomeCity.objects.filter(user=user).delete()
    else:
        city = cities.get(city_id)
        if city is None:
            raise UnknownCity(city_id)
        chosen = label if label and city.has_label(label) else city.name
        HomeCity.objects.update_or_create(
            user=user, defaults={"city_id": city_id, "label": chosen, "sharing": sharing}
        )
    notify_changed(couple.pk, "distance", user.pk, "updated")
