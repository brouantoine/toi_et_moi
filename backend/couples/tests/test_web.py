import pytest
from django.test import Client, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_join_page_shows_code_without_database_lookup(django_assert_num_queries) -> None:
    with django_assert_num_queries(0):
        response = Client().get(reverse("web-join", args=["abc-def"]))
    assert response.status_code == 200
    body = response.content.decode()
    assert "ABCDEF" in body
    assert "bolingo://join/ABCDEF" in body
    assert response["Content-Type"].startswith("text/html")


@pytest.mark.parametrize("code", ["ABC", "ABCDEFG", "ABCDE0", "ABCDE1"])
def test_join_page_rejects_malformed_codes(code: str) -> None:
    assert Client().get(f"/join/{code}/").status_code == 404


@override_settings(IOS_STORE_URL="https://apps.apple.com/app/id1", ANDROID_STORE_URL="")
def test_join_page_lists_only_configured_stores() -> None:
    body = Client().get("/join/ABCDEF/").content.decode()
    assert "https://apps.apple.com/app/id1" in body
    assert "Google Play" not in body


def test_join_page_in_english() -> None:
    body = Client(headers={"accept-language": "en"}).get("/join/ABCDEF/").content.decode()
    assert "Open the app" in body


def test_association_files_absent_until_configured() -> None:
    assert Client().get("/.well-known/apple-app-site-association").status_code == 404
    assert Client().get("/.well-known/assetlinks.json").status_code == 404


@override_settings(
    IOS_APP_IDS=["TEAM.com.example.app"],
    ANDROID_PACKAGE="com.example.app",
    ANDROID_CERT_FINGERPRINTS=["AA:BB"],
)
def test_association_files_when_configured() -> None:
    aasa = Client().get("/.well-known/apple-app-site-association").json()
    assert aasa["applinks"]["details"][0]["appIDs"] == ["TEAM.com.example.app"]
    assert aasa["applinks"]["details"][0]["components"] == [{"/": "/join/*"}]
    links = Client().get("/.well-known/assetlinks.json").json()
    assert links[0]["target"]["package_name"] == "com.example.app"
    assert links[0]["target"]["sha256_cert_fingerprints"] == ["AA:BB"]


@override_settings(PUBLIC_BASE_URL="https://nousdeux.example/")
def test_invitation_exposes_share_url() -> None:
    client = APIClient()
    client.force_authenticate(UserFactory())
    data = client.post(reverse("couple"), {}, format="json").json()
    code = data["invitation"]["code"]
    assert data["invitation"]["share_url"] == f"https://nousdeux.example/join/{code}/"
