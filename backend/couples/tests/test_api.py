from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.models import Couple, CoupleStatus

from .factories import make_couple

pytestmark = pytest.mark.django_db

COUPLE = reverse("couple")
JOIN = reverse("couple-join")
INVITE = reverse("couple-invitation")


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_endpoints_require_auth() -> None:
    anon = APIClient()
    assert anon.get(COUPLE).status_code == 401
    assert anon.post(JOIN, {"code": "ABCDEF"}).status_code == 401
    assert anon.post(INVITE).status_code == 401


def test_full_flow_create_then_partner_joins() -> None:
    alice, bob = UserFactory(first_name="Alice"), UserFactory(first_name="Bob")
    a = client_for(alice)
    assert a.get(COUPLE).status_code == 404

    created = a.post(COUPLE, {"start_date": "2019-06-21", "currency": "eur"}, format="json")
    assert created.status_code == 201, created.content
    body = created.json()
    assert body["status"] == "pending"
    code = body["invitation"]["code"]
    assert body["invitation"]["link"] == f"bolingo://join/{code}"

    joined = client_for(bob).post(JOIN, {"code": code.lower()})
    assert joined.status_code == 200
    assert joined.json()["status"] == "active"
    assert joined.json()["invitation"] is None

    seen_by_alice = a.get(COUPLE).json()
    names = sorted(m["display_name"] for m in seen_by_alice["members"])
    assert names == ["Alice", "Bob"]
    assert all("email" not in m and "birth_date" not in m for m in seen_by_alice["members"])


def test_join_errors_return_stable_codes() -> None:
    _, a, _ = make_couple()
    response = client_for(UserFactory()).post(JOIN, {"code": "ZZZZZZ"})
    assert response.status_code == 400
    assert response.json() == {"code": "invalid_code"}
    already = client_for(a).post(COUPLE, {}, format="json")
    assert already.json() == {"code": "already_in_couple"}


def test_partner_can_edit_couple_info() -> None:
    couple, _, bob = make_couple()
    response = client_for(bob).patch(COUPLE, {"currency": "cad", "start_date": "2018-01-01"})
    assert response.status_code == 200
    couple.refresh_from_db()
    assert couple.currency == "CAD"
    assert str(couple.start_date) == "2018-01-01"


def test_invalid_currency_rejected() -> None:
    _, alice, _ = make_couple()
    assert client_for(alice).patch(COUPLE, {"currency": "12"}).status_code == 400


def test_stranger_cannot_reach_or_change_another_couple() -> None:
    couple, _, _ = make_couple()
    stranger = client_for(UserFactory())
    assert stranger.get(COUPLE).status_code == 404
    assert stranger.patch(COUPLE, {"currency": "USD"}).status_code == 404
    assert stranger.delete(COUPLE).status_code == 400
    couple.refresh_from_db()
    assert couple.currency == "EUR"
    assert couple.status == CoupleStatus.ACTIVE


def test_status_is_read_only() -> None:
    couple, alice, _ = make_couple()
    client_for(alice).patch(COUPLE, {"status": "dissolved"})
    couple.refresh_from_db()
    assert couple.status == CoupleStatus.ACTIVE


def test_regenerate_invitation_and_cancel_pending() -> None:
    alice = UserFactory()
    a = client_for(alice)
    first = a.post(COUPLE, {}, format="json").json()["invitation"]["code"]
    second = a.post(INVITE).json()["invitation"]["code"]
    assert first != second
    assert a.delete(COUPLE).status_code == 204
    assert not Couple.objects.exists()
    assert a.post(INVITE).json() == {"code": "no_pending_couple"}


def test_expired_invitation_is_not_shown_and_can_be_renewed() -> None:
    alice = UserFactory()
    a = client_for(alice)
    a.post(COUPLE, {}, format="json")
    Couple.objects.get().invitations.update(expires_at=timezone.now() - timedelta(minutes=1))
    assert a.get(COUPLE).json()["invitation"] is None
    assert a.post(INVITE).json()["invitation"]["code"]


def test_cannot_regenerate_for_active_couple_or_cancel_it() -> None:
    _, alice, _ = make_couple()
    a = client_for(alice)
    assert a.post(INVITE).json() == {"code": "couple_not_pending"}
    assert a.delete(COUPLE).json() == {"code": "no_pending_couple"}


def test_join_is_throttled() -> None:
    client = client_for(UserFactory())
    statuses = [client.post(JOIN, {"code": "ZZZZZZ"}).status_code for _ in range(12)]
    assert 429 in statuses


def test_couple_colour_is_shared_and_validated() -> None:
    _, a, b = make_couple()
    response = client_for(a).patch(COUPLE, {"accent": "lagon"}, format="json")
    assert response.status_code == 200
    assert response.json()["accent"] == "lagon"
    assert client_for(b).get(COUPLE).json()["accent"] == "lagon"
    assert client_for(a).patch(COUPLE, {"accent": "rose"}, format="json").status_code == 400


def test_new_couples_start_in_brand_violet() -> None:
    _, a, _ = make_couple()
    assert client_for(a).get(COUPLE).json()["accent"] == "violet"
