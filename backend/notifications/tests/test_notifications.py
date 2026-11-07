import datetime as dt
from typing import Any

import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from notifications import services
from notifications.models import NotificationPreference, PushDevice
from notifications.services import in_quiet_hours, notify

pytestmark = pytest.mark.django_db

DEVICES = "/api/v1/notifications/devices/"
PREFS = "/api/v1/notifications/preferences/"
TOKEN = "ExponentPushToken[abc123]"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def sent(monkeypatch) -> list[list[dict[str, Any]]]:
    """Captures what would be POSTed to Expo; every ticket is ok unless told otherwise."""
    batches: list[list[dict[str, Any]]] = []

    def fake_post(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        batches.append(messages)
        return [{"status": "ok"} for _ in messages]

    monkeypatch.setattr(services, "post_to_expo", fake_post)
    monkeypatch.setattr("notifications.tasks.post_to_expo", fake_post)
    return batches


def at(hour: int, minute: int = 0) -> dt.datetime:
    return dt.datetime(2026, 11, 9, hour, minute, tzinfo=dt.UTC)


def test_register_device_then_forget_it() -> None:
    user = UserFactory()
    client = client_for(user)
    assert (
        client.post(DEVICES, {"token": TOKEN, "platform": "ios"}, format="json").status_code == 204
    )
    assert (
        client.post(DEVICES, {"token": TOKEN, "platform": "ios"}, format="json").status_code == 204
    )
    assert PushDevice.objects.get().user == user
    assert client.post(DEVICES + "forget/", {"token": TOKEN}, format="json").status_code == 204
    assert not PushDevice.objects.exists()


def test_a_token_belongs_to_whoever_registers_it_last_and_others_cannot_remove_it() -> None:
    first, second = UserFactory(), UserFactory()
    client_for(first).post(DEVICES, {"token": TOKEN, "platform": "android"}, format="json")
    client_for(second).post(DEVICES, {"token": TOKEN, "platform": "android"}, format="json")
    assert PushDevice.objects.get().user == second
    client_for(first).post(DEVICES + "forget/", {"token": TOKEN}, format="json")
    assert PushDevice.objects.exists()


@pytest.mark.parametrize("token", ["", "abc", "ExponentPushToken[]", "x" * 300])
def test_invalid_token(token: str) -> None:
    response = client_for(UserFactory()).post(
        DEVICES, {"token": token, "platform": "ios"}, format="json"
    )
    assert response.status_code == 400


def test_preferences_are_mine_only() -> None:
    user, other = UserFactory(), UserFactory()
    client = client_for(user)
    prefs = client.get(PREFS).json()
    assert (
        prefs["morning_mood"] is True
        and prefs["morning_time"] == "08:00:00"
        and prefs["discreet"] is False
    )
    response = client.patch(PREFS, {"morning_time": "07:15", "discreet": True}, format="json")
    assert response.status_code == 200
    assert client_for(other).get(PREFS).json()["discreet"] is False
    assert NotificationPreference.objects.get(user=user).morning_time == dt.time(7, 15)
    assert APIClient().get(PREFS).status_code == 401


@pytest.mark.parametrize(
    ("start", "end", "now", "quiet"),
    [
        (dt.time(22), dt.time(8), at(23), True),
        (dt.time(22), dt.time(8), at(5), True),
        (dt.time(22), dt.time(8), at(8), False),
        (dt.time(22), dt.time(8), at(12), False),
        (dt.time(13), dt.time(14), at(13, 30), True),
        (None, None, at(3), False),
    ],
)
def test_quiet_hours_in_the_persons_time_zone(start, end, now, quiet) -> None:
    user = UserFactory(timezone="UTC", quiet_hours_start=start, quiet_hours_end=end)
    assert in_quiet_hours(user, now) is quiet


def test_quiet_hours_follow_the_time_zone() -> None:
    # 06:00 UTC is 07:00 in Paris (winter): still quiet until 08:00 local.
    user = UserFactory(timezone="Europe/Paris")
    assert in_quiet_hours(user, at(6)) is True
    assert in_quiet_hours(user, at(7, 30)) is False


def test_notify_sends_to_every_phone(sent, monkeypatch) -> None:
    monkeypatch.setattr(services, "in_quiet_hours", lambda user, now=None: False)
    user = UserFactory()
    PushDevice.objects.create(user=user, token="ExponentPushToken[a]", platform="ios")
    PushDevice.objects.create(user=user, token="ExponentPushToken[b]", platform="android")
    assert (
        notify(user, "partner_mood", "Titre", "Texte", {"screen": "today"}, category="mood") is True
    )
    (batch,) = sent
    assert {m["to"] for m in batch} == {"ExponentPushToken[a]", "ExponentPushToken[b]"}
    assert batch[0]["data"] == {"kind": "partner_mood", "screen": "today"}
    assert batch[0]["categoryId"] == "mood" and batch[0]["channelId"] == "default"


def test_notify_respects_preferences_quiet_hours_and_missing_phones(sent, monkeypatch) -> None:
    user = UserFactory()
    PushDevice.objects.create(user=user, token="ExponentPushToken[a]", platform="ios")
    monkeypatch.setattr(services, "in_quiet_hours", lambda user, now=None: True)
    assert notify(user, "partner_mood", "t", "b") is False
    monkeypatch.setattr(services, "in_quiet_hours", lambda user, now=None: False)
    NotificationPreference.objects.update_or_create(user=user, defaults={"partner_mood": False})
    assert notify(user, "partner_mood", "t", "b") is False
    assert notify(UserFactory(), "partner_mood", "t", "b") is False
    assert sent == []


def test_tokens_reported_gone_are_forgotten(monkeypatch) -> None:
    user = UserFactory()
    PushDevice.objects.create(user=user, token="ExponentPushToken[alive]", platform="ios")
    PushDevice.objects.create(user=user, token="ExponentPushToken[gone]", platform="ios")
    monkeypatch.setattr(services, "in_quiet_hours", lambda user, now=None: False)
    monkeypatch.setattr(
        "notifications.tasks.post_to_expo",
        lambda messages: [
            {"status": "ok"}
            if m["to"].endswith("[alive]")
            else {"status": "error", "details": {"error": "DeviceNotRegistered"}}
            for m in messages
        ],
    )
    notify(user, "partner_mood", "t", "b")
    assert list(PushDevice.objects.values_list("token", flat=True)) == ["ExponentPushToken[alive]"]
