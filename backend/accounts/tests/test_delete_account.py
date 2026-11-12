from typing import Any

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.factories import UserFactory
from couples.models import Couple
from couples.tests.factories import make_couple
from messaging.models import Message

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def pushes(monkeypatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "notifications.services.notify",
        lambda user, kind, title, body, data=None, **kw: calls.append(
            {"to": user.pk, "title": title, "body": body}
        ),
    )
    return calls


def test_deleting_the_account_erases_it_and_the_shared_space(
    pushes, django_capture_on_commit_callbacks
) -> None:
    couple, me, partner = make_couple(UserFactory(first_name="Antoine"), UserFactory())
    key = f"couples/{couple.pk}/messages/voice.m4a"
    default_storage.save(key, ContentFile(b"voice"))
    Message.objects.create(couple=couple, author=me, kind="voice", media_key=key)
    other, *_ = make_couple()

    refused = client_for(me).delete(ME, {"confirm": "oui"}, format="json")
    assert refused.status_code == 400
    with django_capture_on_commit_callbacks(execute=True):
        done = client_for(me).delete(ME, {"confirm": " Supprimer "}, format="json")
    assert done.status_code == 204
    assert not User.objects.filter(pk=me.pk).exists()
    assert not Couple.objects.filter(pk=couple.pk).exists()
    assert not Message.objects.exists()
    assert not default_storage.exists(key)
    # The partner keeps their account, is told, and is free to start again.
    assert User.objects.filter(pk=partner.pk).exists()
    assert client_for(partner).get("/api/v1/couple/").status_code in (200, 404)
    assert [p["to"] for p in pushes] == [partner.pk]
    assert "Antoine" in pushes[0]["body"]
    # Other couples are untouched.
    assert Couple.objects.filter(pk=other.pk).exists()


def test_a_single_person_can_delete_too_and_english_works(pushes) -> None:
    lonely = UserFactory()
    assert client_for(lonely).delete(ME, {"confirm": "DELETE"}, format="json").status_code == 204
    assert not User.objects.filter(pk=lonely.pk).exists()
    assert pushes == []
    assert APIClient().delete(ME, {"confirm": "DELETE"}, format="json").status_code == 401
