"""Apple / Google sign-in: tokens are signed with locally generated RSA keys and the
JWKS lookup is stubbed, so the full verification path (signature, iss, aud, exp, nonce)
runs for real without network."""

import hashlib
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts import social
from accounts.models import SocialAccount, User

from .factories import UserFactory

pytestmark = pytest.mark.django_db

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
REAL_SIGNING_KEY = social.signing_key  # captured before the autouse stub
APPLE_AUD = "com.changeme.nousdeux"
GOOGLE_AUD = "google-client-ios"


def make_token(key=KEY, **claims) -> str:
    now = int(time.time())
    payload = {"iat": now, "exp": now + 600, "sub": "subject-1", **claims}
    return jwt.encode(payload, key, algorithm="RS256", headers={"kid": "k1"})


def apple_token(**claims) -> str:
    base: dict[str, object] = {"iss": social.APPLE_ISSUER, "aud": APPLE_AUD}
    base["email"] = "a@privaterelay.appleid.com"
    base["email_verified"] = "true"
    return make_token(**{**base, **claims})


def google_token(**claims) -> str:
    base: dict[str, object] = {"iss": "https://accounts.google.com", "aud": GOOGLE_AUD}
    base["email"] = "g@gmail.com"
    base.update(email_verified=True, given_name="Gabi")
    return make_token(**{**base, **claims})


@pytest.fixture(autouse=True)
def stub_jwks():
    with (
        patch("accounts.social.signing_key", return_value=KEY.public_key()),
        override_settings(APPLE_AUDIENCES=[APPLE_AUD], GOOGLE_CLIENT_IDS=[GOOGLE_AUD]),
    ):
        yield


def post(provider: str, **data):
    return APIClient().post(reverse("auth-social", args=[provider]), data, format="json")


# --- Apple ---


def test_apple_creates_user_and_links_identity() -> None:
    nonce = "raw-nonce"
    token = apple_token(nonce=hashlib.sha256(nonce.encode()).hexdigest())
    response = post("apple", id_token=token, nonce=nonce, first_name="Alex")
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["created"] is True
    assert body["user"]["first_name"] == "Alex"
    user = User.objects.get(email="a@privaterelay.appleid.com")
    assert user.email_verified and not user.has_usable_password()
    assert SocialAccount.objects.filter(user=user, provider="apple", subject="subject-1").exists()


def test_apple_second_login_finds_same_user_even_without_email() -> None:
    post("apple", id_token=apple_token())
    response = post("apple", id_token=apple_token(email=None))
    assert response.status_code == 200
    assert response.json()["created"] is False
    assert User.objects.count() == 1


def test_apple_wrong_nonce_rejected() -> None:
    token = apple_token(nonce=hashlib.sha256(b"expected").hexdigest())
    assert post("apple", id_token=token, nonce="other").json() == {"code": "invalid_nonce"}


@pytest.mark.parametrize(
    ("claims", "key", "code"),
    [
        ({"aud": "com.evil.app"}, KEY, "invalid_token"),
        ({"iss": "https://evil.example.com"}, KEY, "invalid_token"),
        ({"exp": int(time.time()) - 3600}, KEY, "expired_token"),
        ({}, OTHER_KEY, "invalid_token"),
    ],
)
def test_apple_rejects_bad_tokens(claims, key, code) -> None:
    base = {"iss": social.APPLE_ISSUER, "aud": APPLE_AUD, "email": "x@example.com"}
    token = make_token(key=key, **{**base, **claims})
    response = post("apple", id_token=token)
    assert response.status_code == 400
    assert response.json() == {"code": code}
    assert not User.objects.exists()


def test_garbage_token_rejected() -> None:
    assert post("apple", id_token="not-a-jwt").json() == {"code": "invalid_token"}


# --- Google ---


def test_google_links_existing_verified_account() -> None:
    existing = UserFactory(email="g@gmail.com", email_verified=False)
    response = post("google", id_token=google_token())
    assert response.status_code == 200
    assert response.json()["created"] is False
    existing.refresh_from_db()
    assert existing.email_verified
    assert SocialAccount.objects.get().user == existing


def test_google_uses_given_name_for_new_user() -> None:
    body = post("google", id_token=google_token(email="new@gmail.com")).json()
    assert body["created"] is True
    assert body["user"]["first_name"] == "Gabi"


def test_unverified_email_never_links_or_steals_account() -> None:
    UserFactory(email="victim@example.com")
    token = google_token(email="victim@example.com", email_verified=False)
    assert post("google", id_token=token).json() == {"code": "email_in_use"}
    assert not SocialAccount.objects.exists()


def test_identity_without_email_cannot_create_account() -> None:
    assert post("google", id_token=google_token(email=None)).json() == {"code": "email_required"}


def test_google_disabled_without_client_ids() -> None:
    with override_settings(GOOGLE_CLIENT_IDS=[]):
        assert post("google", id_token=google_token()).json() == {"code": "provider_disabled"}


def test_unknown_provider() -> None:
    assert post("facebook", id_token="x").json() == {"code": "unknown_provider"}


def test_signing_key_wraps_jwks_errors() -> None:
    with patch.object(social, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("x")
        with pytest.raises(social.SocialAuthError) as exc:
            REAL_SIGNING_KEY("https://jwks.example.com", "token")
    assert exc.value.code == "invalid_token"


def test_signing_key_returns_jwks_key() -> None:
    with patch.object(social, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = "the-key"
        assert REAL_SIGNING_KEY("https://jwks.example.com", "token") == "the-key"
