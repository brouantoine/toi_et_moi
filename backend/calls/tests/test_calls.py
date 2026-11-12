from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from calls import services
from calls.models import Call
from couples.tests.factories import make_couple

pytestmark = pytest.mark.django_db

START = "/api/v1/calls/"
CURRENT = "/api/v1/calls/current/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def pushes(monkeypatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        services,
        "notify",
        lambda user, kind, title, body, data: calls.append(
            {"to": user.pk, "title": title, "body": body, "data": data}
        ),
    )
    return calls


def test_ring_pick_up_and_hang_up(pushes) -> None:
    _, me, partner = make_couple(UserFactory(first_name="Antoine"), UserFactory())
    started = client_for(me).post(START, {"kind": "video"}, format="json")
    assert started.status_code == 201
    call = started.json()
    assert (call["state"], call["direction"], call["media_ready"]) == (
        "ringing",
        "outgoing",
        False,
    )
    assert pushes == [
        {
            "to": partner.pk,
            "title": "Antoine",
            "body": "Appel vidéo",
            "data": {"screen": "call", "call": call["id"]},
        }
    ]
    seen = client_for(partner).get(CURRENT).json()["call"]
    assert (seen["id"], seen["direction"], seen["kind"]) == (call["id"], "incoming", "video")
    # Only the one called can pick up.
    assert client_for(me).post(f"{START}{call['id']}/accept/").json()["code"] == "not_callee"
    picked = client_for(partner).post(f"{START}{call['id']}/accept/").json()
    assert picked["state"] == "ongoing" and picked["answered_at"]
    ended = client_for(me).post(f"{START}{call['id']}/end/").json()
    assert ended["state"] == "ended" and ended["ended_at"]
    assert client_for(partner).get(CURRENT).json() == {"call": None, "media_ready": False}
    # Hanging up twice is harmless.
    assert client_for(partner).post(f"{START}{call['id']}/end/").json()["state"] == "ended"


def test_decline_cancel_and_one_call_at_a_time(pushes) -> None:
    _, me, partner = make_couple()
    first = client_for(me).post(START, {"kind": "audio"}, format="json").json()
    # Calling back while it rings joins the same call instead of ringing twice.
    again = client_for(partner).post(START, {"kind": "audio"}, format="json").json()
    assert again["id"] == first["id"] and again["direction"] == "incoming"
    assert len(pushes) == 1
    assert client_for(partner).post(f"{START}{first['id']}/decline/").json()["state"] == "declined"
    second = client_for(me).post(START, {"kind": "audio"}, format="json").json()
    assert client_for(me).post(f"{START}{second['id']}/end/").json()["state"] == "cancelled"
    third = client_for(me).post(START, {"kind": "audio"}, format="json").json()
    assert client_for(partner).post(f"{START}{third['id']}/end/").json()["state"] == "declined"


def test_unanswered_call_becomes_missed(pushes) -> None:
    _, me, partner = make_couple()
    call = client_for(me).post(START, {"kind": "audio"}, format="json").json()
    Call.objects.filter(pk=call["id"]).update(created_at=timezone.now() - timedelta(minutes=2))
    assert client_for(partner).get(CURRENT).json() == {"call": None, "media_ready": False}
    assert Call.objects.get(pk=call["id"]).state == "missed"
    late = client_for(partner).post(f"{START}{call['id']}/accept/")
    assert late.status_code == 400 and late.json()["code"] == "not_ringing"


def test_discreet_partner_sees_no_name(pushes) -> None:
    from notifications.models import NotificationPreference

    _, me, partner = make_couple()
    NotificationPreference.objects.update_or_create(user=partner, defaults={"discreet": True})
    client_for(me).post(START, {"kind": "audio"}, format="json")
    assert (pushes[0]["title"], pushes[0]["body"]) == ("Bolingo", "Appel entrant")


def test_strangers_and_singles(pushes) -> None:
    _, me, _ = make_couple()
    _, stranger, _ = make_couple()
    call = client_for(me).post(START, {"kind": "audio"}, format="json").json()
    assert client_for(stranger).get(CURRENT).json()["call"] is None
    assert client_for(stranger).post(f"{START}{call['id']}/accept/").status_code == 404
    assert client_for(stranger).post(f"{START}{call['id']}/end/").status_code == 404
    assert client_for(UserFactory()).get(CURRENT).status_code == 403
    assert APIClient().post(START, {"kind": "audio"}, format="json").status_code == 401
    assert client_for(me).post(START, {"kind": "fax"}, format="json").status_code == 400


def test_ice_servers_give_short_lived_turn_credentials(settings) -> None:
    import base64
    import hashlib
    import hmac

    _, me, _ = make_couple()
    settings.TURN_URLS = ["turn:turn.bolingo.test:3478", "turns:turn.bolingo.test:5349"]
    settings.TURN_SECRET = "s3cret"
    data = client_for(me).get(f"{START}ice/").json()
    stun, turn = data["ice_servers"]
    assert stun["urls"][0].startswith("stun:")
    expiry, user_id = turn["username"].split(":")
    assert user_id == str(me.pk) and int(expiry) > timezone.now().timestamp()
    expected = hmac.new(b"s3cret", turn["username"].encode(), hashlib.sha1).digest()
    assert turn["credential"] == base64.b64encode(expected).decode()
    # No TURN configured: STUN only. And only couples may ask.
    settings.TURN_URLS = []
    assert len(client_for(me).get(f"{START}ice/").json()["ice_servers"]) == 1
    assert client_for(UserFactory()).get(f"{START}ice/").status_code == 403
