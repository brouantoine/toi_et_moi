import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User

from .factories import UserFactory

pytestmark = pytest.mark.django_db

ME = reverse("me")


def test_me_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get(ME).status_code == 401
    assert api_client.patch(ME, {"nickname": "x"}).status_code == 401


def test_get_me_returns_own_profile(user_client: APIClient, user: User) -> None:
    body = user_client.get(ME).json()
    assert body["email"] == user.email
    assert body["display_name"] == user.first_name
    assert body["avatar_url"] is None
    assert "password" not in body


def test_patch_me_updates_profile(user_client: APIClient, user: User) -> None:
    response = user_client.patch(
        ME,
        {
            "nickname": "Loulou",
            "language": "en",
            "timezone": "America/Montreal",
            "birth_date": "1992-04-05",
            "quiet_hours_start": "23:00",
            "quiet_hours_end": None,
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    user.refresh_from_db()
    assert user.nickname == "Loulou"
    assert user.display_name == "Loulou"
    assert user.language == "en"
    assert user.timezone == "America/Montreal"
    assert user.quiet_hours_end is None


def test_patch_me_validates_fields(user_client: APIClient) -> None:
    assert user_client.patch(ME, {"timezone": "Atlantis/Core"}).status_code == 400
    assert user_client.patch(ME, {"language": "de"}).status_code == 400


def test_read_only_fields_cannot_be_changed(user_client: APIClient, user: User) -> None:
    user_client.patch(ME, {"email": "hacker@example.com", "email_verified": True}, format="json")
    user.refresh_from_db()
    assert user.email != "hacker@example.com"


def test_put_not_allowed_and_delete_needs_a_typed_confirmation(user_client: APIClient) -> None:
    assert user_client.put(ME, {}).status_code == 405
    # Deleting the account exists (App Store 5.1.1(v)) but never without "SUPPRIMER".
    assert user_client.delete(ME).status_code == 400


def test_user_only_ever_edits_themselves(api_client: APIClient) -> None:
    alice, bob = UserFactory(nickname=""), UserFactory(nickname="")
    api_client.force_authenticate(alice)
    api_client.patch(ME, {"nickname": "Changed"})
    bob.refresh_from_db()
    assert bob.nickname == ""


def test_avatar_preset_is_chosen_from_the_shipped_list(user_client: APIClient, user: User) -> None:
    ok = user_client.patch("/api/v1/me/", {"avatar_preset": "woman-curly-hair-dark"}, format="json")
    assert ok.status_code == 200 and ok.json()["avatar_preset"] == "woman-curly-hair-dark"
    bad = user_client.patch("/api/v1/me/", {"avatar_preset": "../secret"}, format="json")
    assert bad.status_code == 400
    cleared = user_client.patch("/api/v1/me/", {"avatar_preset": ""}, format="json")
    assert cleared.json()["avatar_preset"] == ""


def test_partner_sees_my_avatar_preset() -> None:
    from couples.tests.factories import make_couple

    _, me, partner = make_couple()
    me.avatar_preset = "man-beard-medium-dark"
    me.save()
    client = APIClient()
    client.force_authenticate(partner)
    members = client.get("/api/v1/couple/").json()["members"]
    assert {m["avatar_preset"] for m in members} == {"man-beard-medium-dark", ""}
