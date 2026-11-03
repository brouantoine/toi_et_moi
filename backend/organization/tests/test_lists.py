import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from organization.models import ListItem, SharedList

pytestmark = pytest.mark.django_db

LISTS = "/api/v1/lists/"


def items(list_id: int) -> str:
    return f"/api/v1/lists/{list_id}/items/"


def item(list_id: int, item_id: int) -> str:
    return f"/api/v1/lists/{list_id}/items/{item_id}/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couples():
    couple, alice, bob = make_couple()
    other, carol, _ = make_couple()
    return couple, alice, bob, other, carol


def make_list(client: APIClient, title: str = "Courses", kind: str = "groceries") -> int:
    response = client.post(LISTS, {"title": title, "kind": kind}, format="json")
    assert response.status_code == 201, response.content
    return int(response.json()["id"])


def add(client: APIClient, list_id: int, text: str) -> int:
    response = client.post(items(list_id), {"text": text}, format="json")
    assert response.status_code == 201, response.content
    return int(response.json()["id"])


def test_lists_and_items_append_at_the_end(couples) -> None:
    _, alice, bob, *_ = couples
    a, b = client_for(alice), client_for(bob)
    groceries = make_list(a)
    make_list(b, "Films à voir", "free")
    for text in ["Pain", "Lait", "Clémentines"]:
        add(a, groceries, text)
    assert [x["title"] for x in a.get(LISTS).json()] == ["Courses", "Films à voir"]
    assert [x["text"] for x in b.get(items(groceries)).json()] == ["Pain", "Lait", "Clémentines"]
    assert a.get(LISTS).json()[0]["open_items"] == 3


def test_ticking_records_who_relative_to_the_reader(couples) -> None:
    _, alice, bob, *_ = couples
    a, b = client_for(alice), client_for(bob)
    lst = make_list(a)
    pk = add(a, lst, "Pain")
    ticked = b.patch(item(lst, pk), {"done": True}, format="json").json()
    assert ticked["done"] is True and ticked["done_by"] == "me" and ticked["done_at"]
    assert a.get(item(lst, pk)).json()["done_by"] == "you"
    assert a.get(LISTS).json()[0]["open_items"] == 0
    unticked = a.patch(item(lst, pk), {"done": False}, format="json").json()
    assert (unticked["done"], unticked["done_by"], unticked["done_at"]) == (False, None, None)


def test_reorder_items_requires_exactly_the_list_items(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    lst, other_list = make_list(a), make_list(a, "Autre", "free")
    ids = [add(a, lst, t) for t in ["A", "B", "C"]]
    stray = add(a, other_list, "Z")
    url = items(lst) + "reorder/"
    assert a.post(url, {"ids": [ids[2], ids[0], ids[1]]}, format="json").status_code == 204
    assert [x["text"] for x in a.get(items(lst)).json()] == ["C", "A", "B"]
    for bad in ([ids[0], ids[1]], [*ids, stray], [ids[0], ids[0], ids[1]], []):
        assert a.post(url, {"ids": bad}, format="json").status_code == 400


def test_reorder_lists(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    first, second = make_list(a, "Un"), make_list(a, "Deux")
    assert a.post(LISTS + "reorder/", {"ids": [second, first]}, format="json").status_code == 204
    assert [x["title"] for x in a.get(LISTS).json()] == ["Deux", "Un"]


def test_clear_done_removes_only_ticked_items(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    lst = make_list(a)
    keep, gone = add(a, lst, "Pain"), add(a, lst, "Lait")
    a.patch(item(lst, gone), {"done": True}, format="json")
    assert a.post(items(lst) + "clear-done/").status_code == 204
    assert list(ListItem.objects.values_list("pk", flat=True)) == [keep]


def test_validation(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    assert a.post(LISTS, {"title": "  "}, format="json").status_code == 400
    lst = make_list(a)
    assert a.post(items(lst), {"text": ""}, format="json").status_code == 400
    assert a.post(items(lst), {"text": "x" * 201}, format="json").status_code == 400


def test_strangers_get_404_everywhere(couples) -> None:
    _, alice, _, _, carol = couples
    a, c = client_for(alice), client_for(carol)
    lst = make_list(a)
    pk = add(a, lst, "Pain")
    assert c.get(LISTS).json() == []
    assert c.get(f"{LISTS}{lst}/").status_code == 404
    assert c.get(items(lst)).status_code == 404
    assert c.post(items(lst), {"text": "Intrus"}, format="json").status_code == 404
    assert c.patch(item(lst, pk), {"done": True}, format="json").status_code == 404
    assert c.post(items(lst) + "reorder/", {"ids": [pk]}, format="json").status_code == 404
    assert c.post(items(lst) + "clear-done/").status_code == 404
    assert c.delete(f"{LISTS}{lst}/").status_code == 404
    assert SharedList.objects.count() == 1 and ListItem.objects.get().done is False


def test_partner_can_edit_and_delete(couples) -> None:
    _, alice, bob, *_ = couples
    lst = make_list(client_for(alice))
    pk = add(client_for(alice), lst, "Pain")
    b = client_for(bob)
    assert b.patch(item(lst, pk), {"text": "Pain complet"}, format="json").status_code == 200
    assert b.delete(item(lst, pk)).status_code == 204
    assert b.delete(f"{LISTS}{lst}/").status_code == 204


def test_item_list_query_count(couples, django_assert_max_num_queries) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    lst = make_list(a)
    for i in range(10):
        add(a, lst, f"Article {i}")
    with django_assert_max_num_queries(6):
        assert len(a.get(items(lst)).json()) == 10
    with django_assert_max_num_queries(6):
        a.get(LISTS)
