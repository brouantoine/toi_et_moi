from typing import Any

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from coach import crypto, services
from coach.models import CoachMessage
from coach.prompts import system_prompt
from couples.tests.factories import make_couple

pytestmark = pytest.mark.django_db

THREAD = "/api/v1/coach/"
CONSENT = "/api/v1/coach/consent/"
POST = "/api/v1/coach/messages/"
KEY = override_settings(ANTHROPIC_API_KEY="sk-test")


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def turn_on(*users) -> None:
    for user in users:
        assert client_for(user).put(CONSENT, {"enabled": True}, format="json").status_code == 200


@pytest.fixture
def claude(monkeypatch) -> list[dict[str, Any]]:
    """Replaces the real API call; records what would be sent."""
    calls: list[dict[str, Any]] = []

    def fake(system: str, turns: list[Any]) -> str | None:
        calls.append({"system": system, "turns": turns})
        return "Je vous ai lus tous les deux."

    monkeypatch.setattr(services, "ask_claude", fake)
    return calls


def test_text_is_encrypted_at_rest() -> None:
    stored = crypto.encrypt("On s'est disputés hier")
    assert "disput" not in stored and stored.startswith(crypto.CIPHER_PREFIX)
    assert crypto.decrypt(stored) == "On s'est disputés hier"
    with override_settings(FIELD_ENCRYPTION_KEYS=[]):
        assert crypto.decrypt(crypto.encrypt("abc")) == "abc"


@KEY
def test_needs_both_partners_before_anything_is_said(claude) -> None:
    _, me, partner = make_couple()
    data = client_for(me).get(THREAD).json()
    assert data == {
        "available": True,
        "consent": {"mine": False, "partner": False},
        "active": False,
        "thinking": False,
        "messages": [],
    }
    turn_on(me)
    refused = client_for(me).post(POST, {"text": "Bonjour"}, format="json")
    assert refused.status_code == 400 and refused.json()["code"] == "not_active"
    assert claude == [] and CoachMessage.objects.count() == 0
    turn_on(partner)
    assert client_for(partner).get(THREAD).json()["active"] is True


@KEY
def test_one_shared_thread_answered_for_both(claude) -> None:
    _, me, partner = make_couple()
    turn_on(me, partner)
    client_for(me).post(POST, {"text": "  On se dispute pour le ménage.  "}, format="json")
    reply = client_for(partner).post(POST, {"text": "Je fais déjà beaucoup."}, format="json")
    assert reply.status_code == 201
    mine = client_for(me).get(THREAD).json()["messages"]
    theirs = client_for(partner).get(THREAD).json()["messages"]
    # Same conversation for both; only "me"/"you" flips.
    assert [m["text"] for m in mine] == [m["text"] for m in theirs]
    assert [m["author"] for m in mine] == ["me", "coach", "you", "coach"]
    assert [m["author"] for m in theirs] == ["you", "coach", "me", "coach"]
    # What Claude receives: names in front, both first names in the system prompt.
    last = claude[-1]
    assert last["turns"][0] == {
        "role": "user",
        "content": f"{me.display_name}: On se dispute pour le ménage.",
    }
    assert last["turns"][-1]["content"] == f"{partner.display_name}: Je fais déjà beaucoup."
    assert me.display_name in last["system"] and partner.display_name in last["system"]
    assert "no private channel" in last["system"]
    # Stored encrypted.
    assert all("ménage" not in m.body for m in CoachMessage.objects.all())


@KEY
def test_refusal_or_failure_leaves_a_calm_notice(monkeypatch) -> None:
    _, me, partner = make_couple()
    turn_on(me, partner)
    monkeypatch.setattr(services, "ask_claude", lambda system, turns: None)
    client_for(me).post(POST, {"text": "Bonjour"}, format="json")
    messages = client_for(me).get(THREAD).json()["messages"]
    assert [m["author"] for m in messages] == ["me", "notice"]
    # The notice is never sent back to the model as if the coach had said it.
    history = list(CoachMessage.objects.select_related("author"))
    assert [t["role"] for t in services.build_messages(history)] == ["user"]


def test_without_a_key_the_coach_says_it_is_unavailable(claude) -> None:
    _, me, partner = make_couple()
    turn_on(me, partner)
    assert client_for(me).get(THREAD).json()["available"] is False
    refused = client_for(me).post(POST, {"text": "Bonjour"}, format="json")
    assert refused.json()["code"] == "unavailable" and claude == []


@KEY
def test_turning_off_hides_the_thread_and_either_can_erase_it(claude) -> None:
    _, me, partner = make_couple()
    turn_on(me, partner)
    client_for(me).post(POST, {"text": "Bonjour"}, format="json")
    client_for(partner).put(CONSENT, {"enabled": False}, format="json")
    assert client_for(me).get(THREAD).json()["messages"] == []
    turn_on(partner)
    assert len(client_for(me).get(THREAD).json()["messages"]) == 2
    assert client_for(partner).delete(THREAD).status_code == 204
    assert CoachMessage.objects.count() == 0


@KEY
def test_strangers_and_singles_stay_out(claude) -> None:
    _, me, partner = make_couple()
    _, stranger, other = make_couple()
    turn_on(me, partner, stranger, other)
    client_for(me).post(POST, {"text": "Rien que pour nous"}, format="json")
    assert client_for(stranger).get(THREAD).json()["messages"] == []
    assert client_for(stranger).delete(THREAD).status_code == 204
    assert CoachMessage.objects.count() == 2
    lonely = client_for(UserFactory())
    assert lonely.get(THREAD).status_code == 403
    assert APIClient().get(THREAD).status_code == 401


def test_consecutive_messages_merge_and_prompt_speaks_the_language() -> None:
    couple, me, partner = make_couple()
    for author, text in ((me, "Un"), (me, "Deux"), (partner, "Trois")):
        message = CoachMessage(couple=couple, author=author, role="partner")
        message.text = text
        message.save()
    turns = services.build_messages(list(CoachMessage.objects.select_related("author")))
    assert len(turns) == 1 and turns[0]["role"] == "user"
    assert str(turns[0]["content"]).count("\n\n") == 2
    assert "Reply in English" in system_prompt("A", "B", "en")
    assert "Reply in French" in system_prompt("A", "B", "fr")
