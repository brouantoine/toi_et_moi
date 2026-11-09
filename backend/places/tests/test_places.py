import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple
from places import cities
from places.models import HomeCity

pytestmark = pytest.mark.django_db

SEARCH = reverse("places-search")
DISTANCE = reverse("couple-distance")
PARIS = 2988507
MONTREAL = 6077243
LONDON = 2643743


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couple():
    return make_couple()


def members(couple):
    _, first, second = couple
    return first, second


# --- index -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("query", "expected_id", "label"),
    [
        ("Paris", PARIS, "Paris"),
        ("montreal", MONTREAL, "Montréal"),
        ("Londres", LONDON, "Londres"),
        ("  MONTRÉ ", MONTREAL, "Montréal"),
    ],
)
def test_search_finds_names_and_translations(query: str, expected_id: int, label: str) -> None:
    city, matched = cities.search(query)[0]
    assert (city.id, matched) == (expected_id, label)


def test_search_needs_two_letters() -> None:
    assert cities.search("p") == []
    assert cities.search("") == []


def test_distance_and_rounding() -> None:
    paris, montreal = cities.get(PARIS), cities.get(MONTREAL)
    assert paris and montreal
    assert 5400 < cities.distance_km(paris, montreal) < 5600
    assert cities.distance_km(paris, paris) == 0
    assert [cities.rounded_km(km) for km in (0.4, 7.4, 23, 1238)] == [0, 7, 25, 1240]


# --- API ---------------------------------------------------------------------


def test_search_api_returns_labels_without_coordinates() -> None:
    data = client_for(UserFactory()).get(SEARCH, {"q": "londres"}).json()
    assert data[0] == {"id": LONDON, "name": "Londres", "country": "GB"}
    assert APIClient().get(SEARCH, {"q": "paris"}).status_code == 401


def test_nothing_is_revealed_until_both_share(couple) -> None:
    me, partner = members(couple)
    mine = client_for(me).put(
        DISTANCE, {"city_id": PARIS, "name": "Paris", "sharing": True}, format="json"
    )
    assert mine.status_code == 200
    # The partner chose a city but does not share: no city, no distance.
    client_for(partner).put(DISTANCE, {"city_id": MONTREAL, "sharing": False}, format="json")
    data = client_for(me).get(DISTANCE).json()
    assert data["mine"] == {
        "city": {"id": PARIS, "name": "Paris", "country": "FR"},
        "sharing": True,
    }
    assert data["partner"] == {"sharing": False, "city": None}
    assert data["km"] is None
    # I see nothing either from the partner's side while I do not share.
    client_for(me).put(DISTANCE, {"city_id": PARIS, "sharing": False}, format="json")
    client_for(partner).put(DISTANCE, {"city_id": MONTREAL, "sharing": True}, format="json")
    theirs = client_for(partner).get(DISTANCE).json()
    assert theirs["partner"] == {"sharing": False, "city": None}
    assert theirs["km"] is None


def test_both_sharing_shows_city_and_rounded_distance(couple) -> None:
    me, partner = members(couple)
    client_for(me).put(DISTANCE, {"city_id": PARIS, "sharing": True}, format="json")
    client_for(partner).put(
        DISTANCE, {"city_id": MONTREAL, "name": "Montréal", "sharing": True}, format="json"
    )
    data = client_for(me).get(DISTANCE).json()
    assert data["partner"]["city"] == {"id": MONTREAL, "name": "Montréal", "country": "CA"}
    assert data["km"] % 10 == 0 and 5400 < data["km"] < 5600
    assert "lat" not in str(data) and "lon" not in str(data)


def test_label_must_belong_to_the_city(couple) -> None:
    me, _ = members(couple)
    client_for(me).put(
        DISTANCE, {"city_id": PARIS, "name": "Chez moi rue X", "sharing": True}, format="json"
    )
    assert HomeCity.objects.get(user=me).label == "Paris"


def test_unknown_city_and_clearing(couple) -> None:
    me, _ = members(couple)
    client = client_for(me)
    bad = client.put(DISTANCE, {"city_id": 999_999_999, "sharing": True}, format="json")
    assert bad.status_code == 400
    assert bad.json()["city_id"] == "unknown_city" or "unknown_city" in str(bad.json())
    client.put(DISTANCE, {"city_id": PARIS, "sharing": True}, format="json")
    cleared = client.put(DISTANCE, {"city_id": None, "sharing": False}, format="json").json()
    assert cleared["mine"] == {"city": None, "sharing": False}
    assert not HomeCity.objects.filter(user=me).exists()


def test_distance_needs_an_active_couple() -> None:
    stranger = client_for(UserFactory())
    assert stranger.get(DISTANCE).status_code == 403
    assert (
        stranger.put(DISTANCE, {"city_id": PARIS, "sharing": True}, format="json").status_code
        == 403
    )


def test_another_couple_never_sees_our_cities(couple) -> None:
    me, _ = members(couple)
    client_for(me).put(DISTANCE, {"city_id": PARIS, "sharing": True}, format="json")
    other = make_couple()
    someone, _ = members(other)
    data = client_for(someone).get(DISTANCE).json()
    assert data["partner"] == {"sharing": False, "city": None}
