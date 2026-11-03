import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from memories.models import MemoryComment, MemoryReaction

from .factories import MemoryCommentFactory, MemoryFactory

pytestmark = pytest.mark.django_db


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def setup():
    couple, alice, bob = make_couple()
    _, carol, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    return alice, bob, carol, memory


def heart_url(memory) -> str:
    return f"/api/v1/memories/{memory.pk}/heart/"


def comments_url(memory) -> str:
    return f"/api/v1/memories/{memory.pk}/comments/"


# --- Heart ---


def test_heart_is_idempotent_and_reversible(setup) -> None:
    _, bob, _, memory = setup
    client = client_for(bob)
    assert client.post(heart_url(memory)).json() == {"my_heart": True}
    assert client.post(heart_url(memory)).json() == {"my_heart": True}
    assert MemoryReaction.objects.filter(memory=memory).count() == 1
    assert client.delete(heart_url(memory)).json() == {"my_heart": False}
    assert client.delete(heart_url(memory)).json() == {"my_heart": False}
    assert not MemoryReaction.objects.exists()


def test_partner_sees_the_heart_as_a_boolean(setup) -> None:
    alice, bob, _, memory = setup
    client_for(bob).post(heart_url(memory))
    body = client_for(alice).get(f"/api/v1/memories/{memory.pk}/").json()
    assert body["partner_heart"] is True and body["my_heart"] is False


def test_stranger_cannot_heart(setup) -> None:
    _, _, carol, memory = setup
    assert client_for(carol).post(heart_url(memory)).status_code == 404
    assert not MemoryReaction.objects.exists()


# --- Comments ---


def test_both_partners_comment_and_read(setup) -> None:
    alice, bob, _, memory = setup
    created = client_for(bob).post(comments_url(memory), {"body": "  Quel jour !  "})
    assert created.status_code == 201, created.content
    assert created.json()["body"] == "Quel jour !"
    assert created.json()["mine"] is True
    listed = client_for(alice).get(comments_url(memory)).json()
    assert [c["body"] for c in listed] == ["Quel jour !"]
    assert listed[0]["mine"] is False
    assert listed[0]["author_name"] == bob.display_name


def test_comment_validation(setup) -> None:
    alice, _, _, memory = setup
    client = client_for(alice)
    assert client.post(comments_url(memory), {"body": "   "}).status_code == 400
    assert client.post(comments_url(memory), {"body": "x" * 501}).status_code == 400


def test_only_the_author_deletes_a_comment(setup) -> None:
    alice, bob, _, memory = setup
    comment = MemoryCommentFactory(memory=memory, author=alice)
    response = client_for(bob).delete(f"{comments_url(memory)}{comment.pk}/")
    assert response.status_code == 403
    assert client_for(alice).delete(f"{comments_url(memory)}{comment.pk}/").status_code == 204
    assert not MemoryComment.objects.exists()


def test_stranger_cannot_read_write_or_delete_comments(setup) -> None:
    alice, _, carol, memory = setup
    comment = MemoryCommentFactory(memory=memory, author=alice)
    stranger = client_for(carol)
    assert stranger.get(comments_url(memory)).json() == []
    assert stranger.post(comments_url(memory), {"body": "coucou"}).status_code == 404
    assert stranger.delete(f"{comments_url(memory)}{comment.pk}/").status_code == 404
    assert MemoryComment.objects.count() == 1


def test_comments_listing_has_no_n_plus_one(setup, django_assert_max_num_queries) -> None:
    alice, bob, _, memory = setup
    for i in range(10):
        MemoryCommentFactory(memory=memory, author=alice if i % 2 else bob)
    with django_assert_max_num_queries(4):
        assert len(client_for(alice).get(comments_url(memory)).json()) == 10
