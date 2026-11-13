import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import User

from .factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db

REGISTER = reverse("auth-register")
TOKEN = reverse("auth-token")
REFRESH = reverse("auth-refresh")
LOGOUT = reverse("auth-logout")


def register_payload(**overrides):
    data = {
        "email": "Lea@Example.com",
        "password": "une-phrase-de-passe-solide",
        "first_name": "Léa",
        "is_adult": True,
        "language": "fr",
        "timezone": "Europe/Paris",
    }
    data.update(overrides)
    return data


def test_register_creates_user_and_returns_tokens(api_client: APIClient) -> None:
    response = api_client.post(REGISTER, register_payload(), format="json")
    assert response.status_code == 201, response.content
    body = response.json()
    assert {"access", "refresh", "user"} <= body.keys()
    assert body["user"]["email"] == "lea@example.com"
    assert body["user"]["email_verified"] is False
    assert "password" not in body["user"]
    assert User.objects.get(email="lea@example.com").check_password("une-phrase-de-passe-solide")


def test_register_rejects_weak_password(api_client: APIClient) -> None:
    response = api_client.post(REGISTER, register_payload(password="123"), format="json")
    assert response.status_code == 400
    assert "password" in response.json()


def test_register_rejects_duplicate_email_case_insensitive(api_client: APIClient) -> None:
    UserFactory(email="lea@example.com")
    response = api_client.post(REGISTER, register_payload(), format="json")
    assert response.status_code == 400
    assert "email" in response.json()


def test_register_rejects_unknown_timezone(api_client: APIClient) -> None:
    response = api_client.post(REGISTER, register_payload(timezone="Nowhere/City"), format="json")
    assert response.status_code == 400
    assert "timezone" in response.json()


def test_login_with_good_and_bad_password(api_client: APIClient) -> None:
    user = UserFactory()
    ok = api_client.post(TOKEN, {"email": user.email, "password": DEFAULT_PASSWORD})
    assert ok.status_code == 200
    assert "access" in ok.json()
    bad = api_client.post(TOKEN, {"email": user.email, "password": "wrong-password"})
    assert bad.status_code == 401


def test_refresh_rotates_and_blacklists_old_token(api_client: APIClient) -> None:
    user = UserFactory()
    tokens = api_client.post(TOKEN, {"email": user.email, "password": DEFAULT_PASSWORD}).json()
    first = api_client.post(REFRESH, {"refresh": tokens["refresh"]})
    assert first.status_code == 200
    assert first.json()["refresh"] != tokens["refresh"]
    reused = api_client.post(REFRESH, {"refresh": tokens["refresh"]})
    assert reused.status_code == 401


def test_logout_blacklists_refresh_token(api_client: APIClient) -> None:
    user = UserFactory()
    tokens = api_client.post(TOKEN, {"email": user.email, "password": DEFAULT_PASSWORD}).json()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = api_client.post(LOGOUT, {"refresh": tokens["refresh"]})
    assert response.status_code == 205
    api_client.credentials()
    assert api_client.post(REFRESH, {"refresh": tokens["refresh"]}).status_code == 401


def test_logout_with_invalid_token(api_client: APIClient) -> None:
    api_client.force_authenticate(UserFactory())
    assert api_client.post(LOGOUT, {"refresh": "garbage"}).status_code == 400


def test_logout_requires_authentication(api_client: APIClient) -> None:
    assert api_client.post(LOGOUT, {"refresh": "x"}).status_code == 401


def test_auth_endpoints_are_throttled(api_client: APIClient) -> None:
    statuses = [
        api_client.post(TOKEN, {"email": "x@example.com", "password": "nope"}).status_code
        for _ in range(12)
    ]
    assert 429 in statuses


def _rates(monkeypatch, settings, **rates: str) -> None:
    """Throttle rates are read once at import: patch them where DRF looks them up."""
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    current = SimpleRateThrottle.THROTTLE_RATES
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {**current, **rates})


def test_login_is_throttled_per_email_whatever_the_ip(api_client, monkeypatch, settings) -> None:
    """Password guessing spread over many IPs still hits the per-account limit."""
    _rates(monkeypatch, settings, auth="1000/min", login_email="3/hour")
    statuses = [
        api_client.post(
            TOKEN,
            {"email": "Cible@Example.com", "password": "nope"},
            HTTP_X_FORWARDED_FOR=f"203.0.113.{i}",
        ).status_code
        for i in range(5)
    ]
    assert statuses[:3] == [401, 401, 401] and statuses[3:] == [429, 429]
    other = api_client.post(TOKEN, {"email": "autre@example.com", "password": "nope"})
    assert other.status_code == 401


def test_spoofed_forwarded_for_does_not_reset_the_ip_limit(
    api_client, monkeypatch, settings
) -> None:
    """Behind Nginx only the last X-Forwarded-For entry (added by Nginx) is trusted."""
    _rates(monkeypatch, settings, auth="3/min", login_email="1000/hour")
    statuses = [
        api_client.post(
            TOKEN,
            {"email": f"x{i}@example.com", "password": "nope"},
            HTTP_X_FORWARDED_FOR=f"198.51.100.{i}, 192.0.2.7",
        ).status_code
        for i in range(5)
    ]
    assert 429 in statuses


def test_register_requires_being_an_adult(api_client: APIClient) -> None:
    payload = {"email": "jeune@example.com", "password": "Bolingo-2026!longue", "first_name": "J"}
    missing = api_client.post(REGISTER, payload, format="json")
    assert missing.status_code == 400 and "is_adult" in missing.json()
    refused = api_client.post(REGISTER, {**payload, "is_adult": False}, format="json")
    assert refused.status_code == 400
