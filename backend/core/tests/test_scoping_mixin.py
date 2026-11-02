"""Generic proof that the scoping mixin isolates couples and partners.

Uses the test-only `scoping` app. Real endpoints add their own partner/stranger tests.
"""

import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from core.tests.scoping.models import PersonalThing, PrivateThing, SharedThing
from couples.services import create_couple
from couples.tests.factories import make_couple

pytestmark = [pytest.mark.django_db, pytest.mark.urls("core.tests.scoping.views")]


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def two_couples():
    couple, alice, bob = make_couple()
    other, carol, dan = make_couple()
    return couple, alice, bob, other, carol, dan


def test_anonymous_is_rejected() -> None:
    assert APIClient().get("/shared/").status_code == 401


def test_user_without_active_couple_is_rejected() -> None:
    solo = UserFactory()
    assert client_for(solo).get("/shared/").status_code == 403
    pending = UserFactory()
    create_couple(pending)
    response = client_for(pending).get("/shared/")
    assert response.status_code == 403
    assert response.json()["detail"] == "no_active_couple"


def test_shared_create_is_bound_to_couple_and_author(two_couples) -> None:
    couple, alice, *_ = two_couples
    response = client_for(alice).post("/shared/", {"title": "Courses"})
    assert response.status_code == 201
    thing = SharedThing.objects.get()
    assert thing.couple == couple
    assert thing.created_by == alice


def test_partner_sees_shared_but_stranger_does_not(two_couples) -> None:
    couple, alice, bob, _, carol, _ = two_couples
    thing = SharedThing.objects.create(couple=couple, created_by=alice, title="x")
    assert [t["id"] for t in client_for(bob).get("/shared/").json()["results"]] == [thing.id]
    stranger = client_for(carol)
    assert stranger.get("/shared/").json()["results"] == []
    assert stranger.get(f"/shared/{thing.id}/").status_code == 404
    assert stranger.patch(f"/shared/{thing.id}/", {"title": "hack"}).status_code == 404
    assert stranger.delete(f"/shared/{thing.id}/").status_code == 404
    thing.refresh_from_db()
    assert thing.title == "x"


def test_partner_can_edit_shared_without_moving_it(two_couples) -> None:
    couple, alice, bob, *_ = two_couples
    thing = SharedThing.objects.create(couple=couple, created_by=alice, title="x")
    assert client_for(bob).patch(f"/shared/{thing.id}/", {"title": "y"}).status_code == 200
    thing.refresh_from_db()
    assert thing.title == "y"
    assert thing.created_by == alice  # author never rewritten by an update
    assert thing.couple == couple


def test_private_is_invisible_to_partner_even_by_id(two_couples) -> None:
    couple, alice, bob, _, carol, _ = two_couples
    mine = PrivateThing.objects.create(couple=couple, author=alice, body="secret")
    partner = client_for(bob)
    assert partner.get("/private/").json()["results"] == []
    for method in ("get", "patch", "delete"):
        assert getattr(partner, method)(f"/private/{mine.id}/").status_code == 404
    assert client_for(carol).get(f"/private/{mine.id}/").status_code == 404
    assert [t["id"] for t in client_for(alice).get("/private/").json()["results"]] == [mine.id]
    assert PrivateThing.objects.filter(pk=mine.pk).exists()


def test_private_create_sets_author(two_couples) -> None:
    couple, alice, *_ = two_couples
    assert client_for(alice).post("/private/", {"body": "note"}).status_code == 201
    created = PrivateThing.objects.get()
    assert (created.author, created.couple) == (alice, couple)


def test_personal_data_needs_no_couple_and_stays_with_author() -> None:
    solo, other = UserFactory(), UserFactory()
    assert client_for(solo).post("/personal/", {"body": "journal"}).status_code == 201
    entry = PersonalThing.objects.get()
    assert entry.author == solo
    assert client_for(other).get(f"/personal/{entry.id}/").status_code == 404
    assert client_for(other).get("/personal/").json()["results"] == []


def test_misconfigured_view_fails_loudly() -> None:
    with pytest.raises(ImproperlyConfigured):
        client_for(UserFactory()).get("/broken/")
