"""Avatar (personal) and couple photo (shared) set through direct uploads."""

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple

pytestmark = pytest.mark.django_db


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def upload(key: str) -> str:
    default_storage.save(key, ContentFile(b"img"))
    return key


# --- Avatar ---


def test_avatar_upload_set_replace_and_remove(django_capture_on_commit_callbacks) -> None:
    user = UserFactory()
    client = client_for(user)
    ticket = client.post("/api/v1/me/avatar/upload-url/", {"content_type": "image/jpeg"}).json()
    assert ticket["key"].startswith(f"users/{user.pk}/avatars/")
    first = upload(ticket["key"])
    response = client.put("/api/v1/me/avatar/", {"key": first}, format="json")
    assert response.status_code == 200 and response.json()["url"]
    assert client.get("/api/v1/me/").json()["avatar_url"]

    second = upload(f"users/{user.pk}/avatars/second.jpg")
    with django_capture_on_commit_callbacks(execute=True):
        client.put("/api/v1/me/avatar/", {"key": second}, format="json")
    assert not default_storage.exists(first)  # replaced file really deleted

    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete("/api/v1/me/avatar/").status_code == 204
    assert not default_storage.exists(second)
    user.refresh_from_db()
    assert not user.avatar


def test_avatar_rejects_keys_of_someone_else_or_missing() -> None:
    alice, bob = UserFactory(), UserFactory()
    bobs_key = upload(f"users/{bob.pk}/avatars/bob.jpg")
    client = client_for(alice)
    assert client.put("/api/v1/me/avatar/", {"key": bobs_key}).json() == {"code": "invalid_key"}
    missing = f"users/{alice.pk}/avatars/none.jpg"
    assert client.put("/api/v1/me/avatar/", {"key": missing}).json() == {"code": "upload_missing"}
    assert client.post("/api/v1/me/avatar/upload-url/", {"content_type": "text/plain"}).json() == {
        "code": "unsupported_type"
    }


def test_avatar_requires_auth() -> None:
    assert APIClient().put("/api/v1/me/avatar/", {"key": "x"}).status_code == 401
    assert APIClient().post("/api/v1/me/avatar/upload-url/", {}).status_code == 401


# --- Couple photo ---


def test_partner_sets_couple_photo_visible_to_both() -> None:
    couple, alice, bob = make_couple()
    ticket = (
        client_for(bob)
        .post("/api/v1/couple/photo/upload-url/", {"content_type": "image/png"})
        .json()
    )
    assert ticket["key"].startswith(f"couples/{couple.pk}/photo/")
    upload(ticket["key"])
    assert client_for(bob).put("/api/v1/couple/photo/", {"key": ticket["key"]}).status_code == 200
    assert client_for(alice).get("/api/v1/couple/").json()["photo_url"]


def test_stranger_cannot_use_another_couple_photo_key() -> None:
    couple, _, _ = make_couple()
    other, carol, _ = make_couple()
    key = upload(f"couples/{couple.pk}/photo/ours.jpg")
    response = client_for(carol).put("/api/v1/couple/photo/", {"key": key})
    assert response.json() == {"code": "invalid_key"}
    other.refresh_from_db()
    assert not other.photo


def test_couple_photo_requires_active_couple() -> None:
    solo = client_for(UserFactory())
    assert (
        solo.post("/api/v1/couple/photo/upload-url/", {"content_type": "image/png"}).status_code
        == 403
    )
    assert solo.delete("/api/v1/couple/photo/").status_code == 403
