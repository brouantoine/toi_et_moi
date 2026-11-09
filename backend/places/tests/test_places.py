import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple
from places import cities
from places.models import LocationShare
from places.services import TERMS_VERSION

pytestmark = pytest.mark.django_db

NOTHING = {"sharing": False, "city": None, "position": None}

DISTANCE = reverse("couple-distance")
CONSENT = reverse("couple-distance-consent")
PARIS = (48.8566, 2.3522)
MONTREAL = (45.5019, -73.5674)
ABIDJAN = (5.3600, -4.0083)


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def consent(client: APIClient) -> None:
    assert client.post(CONSENT, {"terms_version": TERMS_VERSION}, format="json").status_code == 200


def share(client: APIClient, point: tuple[float, float]):
    lat, lon = point
    return client.put(DISTANCE, {"latitude": lat, "longitude": lon}, format="json")


# --- geometry ----------------------------------------------------------------


def test_nearest_city_and_distance() -> None:
    assert cities.nearest(*PARIS).name == "Paris"  # type: ignore[union-attr]
    assert cities.nearest(*ABIDJAN).name == "Abidjan"  # type: ignore[union-attr]
    assert 5480 < cities.km_between(*PARIS, *MONTREAL) < 5540
    assert cities.km_between(*PARIS, *PARIS) == 0
    assert [cities.rounded_km(km) for km in (0.4, 7.4, 23, 1238)] == [0, 7, 25, 1240]


# --- consent -------------------------------------------------------------------


def test_position_refused_without_consent() -> None:
    _, me, _ = make_couple()
    response = share(client_for(me), PARIS)
    assert response.status_code == 403
    assert not LocationShare.objects.filter(user=me).exists()


def test_outdated_terms_are_refused() -> None:
    _, me, _ = make_couple()
    response = client_for(me).post(CONSENT, {"terms_version": 99}, format="json")
    assert response.status_code == 400


def test_consent_alone_reveals_nothing() -> None:
    _, me, partner = make_couple()
    consent(client_for(me))
    data = client_for(me).get(DISTANCE).json()
    assert data["mine"]["consented"] is True
    assert data["mine"]["sharing"] is False
    assert data["km"] is None
    assert client_for(partner).get(DISTANCE).json()["partner"] == NOTHING


# --- distance ------------------------------------------------------------------


def test_nothing_about_the_partner_until_both_share() -> None:
    _, me, partner = make_couple()
    mine = client_for(me)
    consent(mine)
    assert share(mine, PARIS).status_code == 200
    data = mine.get(DISTANCE).json()
    assert data["mine"]["city"] == {"name": "Paris", "country": "FR"}
    assert data["partner"] == NOTHING
    assert data["km"] is None
    # The partner (not sharing) sees that I share, but neither my city nor a distance.
    theirs = client_for(partner).get(DISTANCE).json()
    assert theirs["partner"] == {"sharing": True, "city": None, "position": None}
    assert theirs["km"] is None


def test_both_sharing_gives_distance_city_and_map_position() -> None:
    _, me, partner = make_couple()
    for user, point in ((me, PARIS), (partner, MONTREAL)):
        client = client_for(user)
        consent(client)
        share(client, point)
    data = client_for(me).get(DISTANCE).json()
    assert data["partner"]["city"] == {"name": "Montréal", "country": "CA"}
    assert data["km"] % 10 == 0 and 5480 <= data["km"] <= 5540
    position = data["partner"]["position"]
    assert (position["latitude"], position["longitude"]) == MONTREAL
    assert position["located_at"]


def test_stopping_erases_the_position_at_once() -> None:
    _, me, partner = make_couple()
    for user, point in ((me, PARIS), (partner, MONTREAL)):
        client = client_for(user)
        consent(client)
        share(client, point)
    assert client_for(me).delete(DISTANCE).status_code == 204
    assert not LocationShare.objects.filter(user=me).exists()
    data = client_for(partner).get(DISTANCE).json()
    assert data["partner"] == NOTHING
    assert data["km"] is None


def test_invalid_coordinates_rejected() -> None:
    _, me, _ = make_couple()
    client = client_for(me)
    consent(client)
    assert share(client, (91.0, 0.0)).status_code == 400
    assert share(client, (0.0, 181.0)).status_code == 400


def test_needs_an_active_couple_and_strangers_see_nothing() -> None:
    lonely = client_for(UserFactory())
    assert lonely.get(DISTANCE).status_code == 403
    assert lonely.post(CONSENT, {"terms_version": TERMS_VERSION}, format="json").status_code == 403
    _, me, _ = make_couple()
    consent(client_for(me))
    share(client_for(me), PARIS)
    _, stranger, _ = make_couple()
    data = client_for(stranger).get(DISTANCE).json()
    assert data["partner"] == NOTHING


def test_one_sided_sharing_never_exposes_my_position() -> None:
    _, me, partner = make_couple()
    consent(client_for(me))
    share(client_for(me), PARIS)
    consent(client_for(partner))  # accepted the terms, but has not shared yet
    assert client_for(partner).get(DISTANCE).json()["partner"]["position"] is None
    _, stranger, _ = make_couple()
    assert "48.85" not in str(client_for(stranger).get(DISTANCE).json())
