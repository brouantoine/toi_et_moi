import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple
from memories.models import Memory, MemoryReaction
from memories.services import normalize_tags

from .factories import MemoryFactory, MemoryPhotoFactory

pytestmark = pytest.mark.django_db

LIST = "/api/v1/memories/"


def detail(pk: int) -> str:
    return f"/api/v1/memories/{pk}/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couples():
    couple, alice, bob = make_couple()
    other, carol, _ = make_couple()
    return couple, alice, bob, other, carol


def test_create_memory_bound_to_couple_and_author(couples) -> None:
    couple, alice, *_ = couples
    response = client_for(alice).post(
        LIST,
        {
            "title": "  Notre premier café  ",
            "body": "Il pleuvait.",
            "happened_on": "2019-03-02",
            "place": "Rue des Lilas",
            "type": "first_time",
            "tags": ["Café", "café ", "pluie"],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert body["title"] == "Notre premier café"
    assert body["tags"] == ["café", "pluie"]
    assert body["my_heart"] is False and body["partner_heart"] is False
    memory = Memory.objects.get()
    assert (memory.couple, memory.created_by) == (couple, alice)


def test_validation(couples) -> None:
    _, alice, *_ = couples
    client = client_for(alice)
    assert client.post(LIST, {"title": " ", "happened_on": "2020-01-01"}).status_code == 400
    assert client.post(LIST, {"title": "x"}).status_code == 400
    assert (
        client.post(LIST, {"title": "x", "happened_on": "2020-01-01", "type": "score"}).status_code
        == 400
    )


def test_list_is_chronological_newest_first(couples) -> None:
    couple, alice, bob, *_ = couples
    MemoryFactory(couple=couple, created_by=alice, title="A", happened_on="2020-01-01")
    MemoryFactory(couple=couple, created_by=bob, title="B", happened_on="2023-05-05")
    MemoryFactory(couple=couple, created_by=alice, title="C", happened_on="2021-07-14")
    titles = [m["title"] for m in client_for(bob).get(LIST).json()["results"]]
    assert titles == ["B", "C", "A"]


def test_filters_type_tag_and_search(couples) -> None:
    couple, alice, *_ = couples
    MemoryFactory(couple=couple, title="Plage de Biarritz", type="place", tags=["vacances"])
    MemoryFactory(couple=couple, title="Le fou rire", body="au restaurant", type="inside_joke")
    MemoryFactory(couple=couple, title="Dimanche", place="Biarritz", type="moment")
    client = client_for(alice)

    def titles(query: str) -> list[str]:
        return sorted(m["title"] for m in client.get(LIST + query).json()["results"])

    assert titles("?type=place") == ["Plage de Biarritz"]
    assert titles("?tag=Vacances") == ["Plage de Biarritz"]
    assert titles("?q=biarritz") == ["Dimanche", "Plage de Biarritz"]
    assert titles("?q=fou restaurant") == ["Le fou rire"]
    assert titles("?type=unknown") == ["Dimanche", "Le fou rire", "Plage de Biarritz"]


def test_partner_can_read_edit_and_delete_shared_memory(couples) -> None:
    couple, alice, bob, *_ = couples
    memory = MemoryFactory(couple=couple, created_by=alice)
    partner = client_for(bob)
    assert partner.get(detail(memory.pk)).status_code == 200
    response = partner.patch(detail(memory.pk), {"title": "Renommé"}, format="json")
    assert response.status_code == 200
    memory.refresh_from_db()
    assert memory.title == "Renommé" and memory.created_by == alice
    assert partner.delete(detail(memory.pk)).status_code == 204


def test_stranger_cannot_list_read_edit_or_delete(couples) -> None:
    couple, alice, _, _, carol = couples
    memory = MemoryFactory(couple=couple, created_by=alice, title="Secret à deux")
    stranger = client_for(carol)
    assert stranger.get(LIST).json()["results"] == []
    assert stranger.get(LIST + "?q=Secret").json()["results"] == []
    assert stranger.get(detail(memory.pk)).status_code == 404
    assert stranger.patch(detail(memory.pk), {"title": "x"}, format="json").status_code == 404
    assert stranger.delete(detail(memory.pk)).status_code == 404
    assert Memory.objects.filter(pk=memory.pk, title="Secret à deux").exists()


def test_without_couple_or_auth() -> None:
    assert APIClient().get(LIST).status_code == 401
    assert client_for(UserFactory()).get(LIST).status_code == 403


def test_hearts_are_booleans_never_counts(couples) -> None:
    couple, alice, bob, *_ = couples
    memory = MemoryFactory(couple=couple, created_by=alice)
    MemoryReaction.objects.create(memory=memory, user=bob)
    as_alice = client_for(alice).get(detail(memory.pk)).json()
    as_bob = client_for(bob).get(detail(memory.pk)).json()
    assert (as_alice["my_heart"], as_alice["partner_heart"]) == (False, True)
    assert (as_bob["my_heart"], as_bob["partner_heart"]) == (True, False)
    assert not any("count" in key for key in as_alice)


def test_photos_are_served_with_signed_urls(couples) -> None:
    couple, alice, *_ = couples
    memory = MemoryFactory(couple=couple, created_by=alice)
    MemoryPhotoFactory(memory=memory, key=f"couples/{couple.pk}/memories/p.jpg")
    photo = client_for(alice).get(detail(memory.pk)).json()["photos"][0]
    assert photo["url"] and photo["thumbnail_url"]


def test_list_has_no_n_plus_one(couples, django_assert_max_num_queries) -> None:
    couple, alice, bob, *_ = couples
    for i in range(8):
        memory = MemoryFactory(couple=couple, created_by=alice)
        MemoryPhotoFactory(memory=memory, key=f"couples/{couple.pk}/memories/{i}.jpg")
        MemoryReaction.objects.create(memory=memory, user=bob)
    client = client_for(alice)
    with django_assert_max_num_queries(6):
        response = client.get(LIST)
    assert len(response.json()["results"]) == 8


def test_normalize_tags_limits() -> None:
    assert normalize_tags([" A  b ", "a b", ""] + [f"t{i}" for i in range(20)]) == [
        "a b",
        *[f"t{i}" for i in range(9)],
    ]
