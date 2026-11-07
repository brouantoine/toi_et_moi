import datetime as dt
from typing import Any

import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple
from notifications.models import NotificationPreference, PushDevice
from rituals import services
from rituals.messages import partner_mood
from rituals.models import MoodReply, MorningMood

pytestmark = pytest.mark.django_db

TODAY = "/api/v1/morning/today/"
REPLY = "/api/v1/morning/reply/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def pushes(monkeypatch) -> list[dict[str, Any]]:
    """Every notify() call, as the user would receive it (quiet hours off)."""
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr("notifications.services.in_quiet_hours", lambda user, now=None: False)

    def fake_send(
        tokens: list[str], title: str, body: str, data: dict[str, Any], category: str | None = None
    ) -> None:
        calls.append(
            {"tokens": tokens, "title": title, "body": body, "data": data, "category": category}
        )

    monkeypatch.setattr("notifications.tasks.send_push.delay", fake_send)
    return calls


@pytest.fixture
def couple():
    couple, antoine, sam = make_couple(
        UserFactory(first_name="Antoine"), UserFactory(first_name="Sam")
    )
    for user in (antoine, sam):
        PushDevice.objects.create(user=user, token=f"ExponentPushToken[{user.pk}]", platform="ios")
    return couple, antoine, sam


def test_messages_tell_how_to_speak_or_stay_discreet() -> None:
    title, body = partner_mood("fr", "Antoine", "angry", "space", discreet=False)
    assert title == "Météo de Antoine"
    assert (
        body
        == "Énervement ce matin · besoin d’espace. Laisse un peu d’espace, un mot court suffit."
    )
    assert partner_mood("fr", "Antoine", "angry", "", discreet=False)[1].endswith(
        "pas de discours."
    )
    assert partner_mood("fr", "Antoine", "joyful", "", discreet=True) == (
        "Nous Deux",
        "Antoine a partagé sa météo du matin.",
    )
    assert partner_mood("en", "Sam", "happy", "hug", discreet=False)[1].startswith(
        "Good mood this morning"
    )


def test_sharing_tells_the_partner_once(couple, pushes, django_capture_on_commit_callbacks) -> None:
    _, antoine, sam = couple
    with django_capture_on_commit_callbacks(execute=True):
        response = client_for(antoine).put(TODAY, {"mood": "angry", "need": "space"}, format="json")
    assert response.status_code == 200, response.content
    assert response.json()["mine"] == {"mood": "angry", "need": "space", "replies": []}
    assert response.json()["partner"] is None
    (push,) = pushes
    assert push["tokens"] == [f"ExponentPushToken[{sam.pk}]"]
    assert push["body"].startswith("Énervement ce matin · besoin d’espace.")
    assert push["data"] == {"kind": "partner_mood", "screen": "today"}

    with django_capture_on_commit_callbacks(execute=True):
        client_for(antoine).put(TODAY, {"mood": "angry", "need": "space"}, format="json")
    assert len(pushes) == 1  # unchanged: no second notification
    seen = client_for(sam).get(TODAY).json()
    assert seen["partner"]["mood"] == "angry" and seen["mine"] is None


def test_discreet_partner_gets_no_detail(
    couple, pushes, django_capture_on_commit_callbacks
) -> None:
    _, antoine, sam = couple
    NotificationPreference.objects.update_or_create(user=sam, defaults={"discreet": True})
    with django_capture_on_commit_callbacks(execute=True):
        client_for(antoine).put(TODAY, {"mood": "upset"}, format="json")
    assert pushes[0]["body"] == "Antoine a partagé sa météo du matin."


def test_one_tap_replies(couple, pushes, django_capture_on_commit_callbacks) -> None:
    _, antoine, sam = couple
    assert client_for(sam).post(REPLY, {"reply": "here"}, format="json").status_code == 404
    with django_capture_on_commit_callbacks(execute=True):
        client_for(antoine).put(TODAY, {"mood": "upset"}, format="json")
    pushes.clear()
    assert client_for(sam).post(REPLY, {"reply": "here"}, format="json").status_code == 204
    assert pushes[0]["title"] == "Sam" and pushes[0]["body"] == "Je suis là."
    assert client_for(antoine).get(TODAY).json()["mine"]["replies"] == ["here"]
    assert client_for(sam).get(TODAY).json()["partner"]["replies"] == ["here"]
    client_for(sam).post(REPLY, {"reply": "courage"}, format="json")
    client_for(sam).post(REPLY, {"reply": "thinking"}, format="json")
    assert client_for(sam).post(REPLY, {"reply": "tonight"}, format="json").status_code == 429


def test_taking_it_back_and_validation(couple) -> None:
    _, antoine, _ = couple
    client = client_for(antoine)
    assert client.put(TODAY, {"mood": "furious"}, format="json").status_code == 400
    assert client.put(TODAY, {"mood": "happy", "need": "money"}, format="json").status_code == 400
    client.put(TODAY, {"mood": "happy"}, format="json")
    assert client.delete(TODAY).status_code == 204
    assert client.get(TODAY).json()["mine"] is None


def test_strangers_and_people_without_couple(couple) -> None:
    _, antoine, _ = couple
    _, carol, _ = make_couple()
    client_for(antoine).put(TODAY, {"mood": "joyful"}, format="json")
    seen = client_for(carol).get(TODAY).json()
    assert seen["mine"] is None and seen["partner"] is None
    assert client_for(carol).post(REPLY, {"reply": "here"}, format="json").status_code == 404
    assert client_for(UserFactory()).get(TODAY).status_code == 403
    assert APIClient().get(TODAY).status_code == 401


def at(hour: int, minute: int = 0) -> dt.datetime:
    return dt.datetime(2026, 11, 9, hour, minute, tzinfo=dt.UTC)


def test_morning_invitation_once_at_local_time(couple, pushes) -> None:
    _, antoine, sam = couple
    antoine.timezone = "Europe/Paris"  # 08:00 Paris = 07:00 UTC in November
    antoine.save()
    sam.timezone = "UTC"
    sam.save()
    NotificationPreference.objects.update_or_create(user=sam, defaults={"morning_mood": False})

    assert services.send_morning_invitations(at(6, 55)) == 0
    assert services.send_morning_invitations(at(7, 5)) == 1
    assert pushes[0]["title"] == "Bonjour Antoine" and pushes[0]["category"] == "morning_mood"
    assert services.send_morning_invitations(at(7, 10)) == 0  # once a day


def test_no_invitation_when_already_shared(couple, pushes) -> None:
    couple_, antoine, _ = couple
    antoine.timezone = "UTC"
    antoine.save()
    MorningMood.objects.create(user=antoine, couple=couple_, day=dt.date(2026, 11, 9), mood="happy")
    assert services.send_morning_invitations(at(8, 1)) == 0


def test_moods_are_forgotten_after_two_days(couple) -> None:
    couple_, antoine, sam = couple
    old = MorningMood.objects.create(
        user=antoine, couple=couple_, day=dt.date(2026, 11, 1), mood="upset"
    )
    MoodReply.objects.create(mood=old, author=sam, reply="here")
    MorningMood.objects.create(user=antoine, couple=couple_, day=dt.date(2026, 11, 9), mood="happy")
    assert services.forget_old_moods(at(12)) == 2  # the mood and its reply
    assert list(MorningMood.objects.values_list("day", flat=True)) == [dt.date(2026, 11, 9)]
