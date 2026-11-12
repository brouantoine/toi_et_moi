import re
from unittest.mock import patch

import pytest
from django.core import mail, signing
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tokens import EMAIL_VERIFICATION_MAX_AGE, make_email_verification_token

from .factories import UserFactory

pytestmark = pytest.mark.django_db

LINK_RE = re.compile(r"https://api\.example\.com(/account/\S+)")


def last_link() -> str:
    body = str(mail.outbox[-1].body)
    match = LINK_RE.search(body)
    assert match, body
    return match.group(1)


# --- Email verification ---


def test_register_sends_verification_email_in_user_language(api_client: APIClient) -> None:
    api_client.post(
        reverse("auth-register"),
        {
            "email": "sam@example.com",
            "password": "une-phrase-de-passe-solide",
            "first_name": "Sam",
            "is_adult": True,
            "language": "en",
        },
        format="json",
    )
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["sam@example.com"]
    assert message.subject.startswith("Confirm your email")
    assert "/account/verify-email/" in message.body


def test_verification_link_marks_email_verified_and_is_idempotent(api_client: APIClient) -> None:
    user = UserFactory(email_verified=False)
    token = make_email_verification_token(user)
    url = reverse("web-verify-email", args=[token])
    first = api_client.get(url)
    assert first.status_code == 200
    user.refresh_from_db()
    assert user.email_verified
    assert api_client.get(url).status_code == 200  # reuse is harmless


def test_verification_api_endpoint(api_client: APIClient) -> None:
    user = UserFactory(email_verified=False)
    response = api_client.post(
        reverse("auth-verify-email"), {"token": make_email_verification_token(user)}
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.email_verified


def test_verification_token_invalid_or_expired(api_client: APIClient) -> None:
    user = UserFactory(email_verified=False)
    token = make_email_verification_token(user)
    assert api_client.post(reverse("auth-verify-email"), {"token": "bogus"}).status_code == 400
    real_loads = signing.loads

    def expired_loads(*args, **kwargs):
        kwargs["max_age"] = -1
        return real_loads(*args, **kwargs)

    with patch("accounts.tokens.signing.loads", side_effect=expired_loads):
        assert api_client.get(reverse("web-verify-email", args=[token])).status_code == 400
    user.refresh_from_db()
    assert not user.email_verified
    assert EMAIL_VERIFICATION_MAX_AGE == 3 * 24 * 3600


def test_verification_token_dies_when_email_changes(api_client: APIClient) -> None:
    user = UserFactory(email_verified=False)
    token = make_email_verification_token(user)
    user.email = "new@example.com"
    user.save()
    assert api_client.post(reverse("auth-verify-email"), {"token": token}).status_code == 400


def test_resend_verification(api_client: APIClient) -> None:
    unverified = UserFactory(email_verified=False)
    api_client.force_authenticate(unverified)
    assert api_client.post(reverse("auth-verify-email-resend")).status_code == 204
    assert len(mail.outbox) == 1
    verified = UserFactory(email_verified=True)
    api_client.force_authenticate(verified)
    api_client.post(reverse("auth-verify-email-resend"))
    assert len(mail.outbox) == 1  # nothing sent to an already verified user


def test_resend_requires_auth(api_client: APIClient) -> None:
    assert api_client.post(reverse("auth-verify-email-resend")).status_code == 401


# --- Password reset ---


def test_password_reset_gives_no_hint_about_existence(api_client: APIClient) -> None:
    UserFactory(email="known@example.com")
    known = api_client.post(reverse("auth-pw-reset"), {"email": "known@example.com"})
    unknown = api_client.post(reverse("auth-pw-reset"), {"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 204
    assert known.content == unknown.content
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["known@example.com"]


def test_password_reset_skips_social_only_accounts(api_client: APIClient) -> None:
    user = UserFactory()
    user.set_unusable_password()
    user.save()
    api_client.post(reverse("auth-pw-reset"), {"email": user.email})
    assert mail.outbox == []


def test_password_reset_via_api_works_once(api_client: APIClient) -> None:
    user = UserFactory(language="fr")
    api_client.post(reverse("auth-pw-reset"), {"email": user.email})
    assert mail.outbox[0].subject.startswith("Choisis un nouveau mot de passe")
    _, _, uid, token, _ = last_link().split("/")[1:]  # /account/reset/<uid>/<token>/
    payload = {"uid": uid, "token": token, "new_password": "nouvelle-phrase-solide"}
    ok = api_client.post(reverse("auth-pw-reset-confirm"), payload)
    assert ok.status_code == 204
    user.refresh_from_db()
    assert user.check_password("nouvelle-phrase-solide")
    payload["new_password"] = "encore-une-autre-phrase"
    reused = api_client.post(reverse("auth-pw-reset-confirm"), payload)
    assert reused.status_code == 400


def test_password_reset_rejects_weak_password_and_bad_uid(api_client: APIClient) -> None:
    user = UserFactory()
    api_client.post(reverse("auth-pw-reset"), {"email": user.email})
    _, _, uid, token, _ = last_link().split("/")[1:]
    weak = api_client.post(
        reverse("auth-pw-reset-confirm"), {"uid": uid, "token": token, "new_password": "123"}
    )
    assert weak.status_code == 400
    assert "new_password" in weak.json()
    bad_uid = api_client.post(
        reverse("auth-pw-reset-confirm"),
        {"uid": "!!", "token": token, "new_password": "nouvelle-phrase-solide"},
    )
    assert bad_uid.status_code == 400


def test_password_reset_web_form(client) -> None:
    user = UserFactory()
    APIClient().post(reverse("auth-pw-reset"), {"email": user.email})
    link = last_link()
    page = client.get(link, follow=True)  # Django redirects to a token-less URL
    assert page.status_code == 200
    assert b"new_password1" in page.content
    form_url = page.redirect_chain[-1][0]
    done = client.post(
        form_url,
        {"new_password1": "phrase-web-solide-42", "new_password2": "phrase-web-solide-42"},
        follow=True,
    )
    assert done.status_code == 200
    user.refresh_from_db()
    assert user.check_password("phrase-web-solide-42")
    assert client.get(link).status_code == 200  # link now shows "no longer works"
    assert b"new_password1" not in client.get(link, follow=True).content


def test_web_pages_are_bilingual(client) -> None:
    fr = client.get(reverse("web-verify-email", args=["bad"]), HTTP_ACCEPT_LANGUAGE="fr")
    en = client.get(reverse("web-verify-email", args=["bad"]), HTTP_ACCEPT_LANGUAGE="en")
    assert "Ce lien ne fonctionne plus" in fr.content.decode()
    assert "This link no longer works" in en.content.decode()
