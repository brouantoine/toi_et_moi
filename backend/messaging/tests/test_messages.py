from typing import Any

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from core import storage
from couples.tests.factories import make_couple
from messaging.messages import notification
from messaging.models import Message
from notifications.models import NotificationPreference, PushDevice

pytestmark = pytest.mark.django_db

LIST = "/api/v1/messages/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couples():
    couple, antoine, sam = make_couple(
        UserFactory(first_name="Antoine"), UserFactory(first_name="Sam")
    )
    other, carol, _ = make_couple()
    PushDevice.objects.create(user=sam, token="ExponentPushToken[sam]", platform="ios")
    return couple, antoine, sam, other, carol


@pytest.fixture
def pushes(monkeypatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr("notifications.services.in_quiet_hours", lambda user, now=None: False)

    def fake_send(
        tokens: list[str], title: str, body: str, data: dict[str, Any], category: str | None = None
    ) -> None:
        calls.append({"title": title, "body": body, "data": data})

    monkeypatch.setattr("notifications.tasks.send_push.delay", fake_send)
    return calls


def uploaded(couple_id: int, extension: str) -> str:
    key = f"couples/{couple_id}/messages/abc{extension.replace('.', '')}.{extension}"
    default_storage.save(key, ContentFile(b"data"))
    return key


def test_texts_tell_or_stay_discreet() -> None:
    assert notification("fr", "Antoine", "text", "Tu rentres à quelle heure ?", False) == (
        "Antoine",
        "Tu rentres à quelle heure ?",
    )
    assert (
        notification("fr", "Antoine", "voice", "", False)[1]
        == "Antoine t’a envoyé une note vocale."
    )
    assert notification("fr", "Antoine", "text", "secret", True) == (
        "Bolingo",
        "Antoine t’a écrit.",
    )
    assert notification("en", "Sam", "text", "x" * 300, False)[1].endswith("…")


def test_send_text_read_by_partner_unread_at_first(
    couples, pushes, django_capture_on_commit_callbacks
) -> None:
    _, antoine, sam, *_ = couples
    with django_capture_on_commit_callbacks(execute=True):
        response = client_for(antoine).post(
            LIST, {"text": "  Tu rentres à quelle heure ?  "}, format="json"
        )
    assert response.status_code == 201, response.content
    body = response.json()
    assert (body["kind"], body["text"], body["author"]) == (
        "text",
        "Tu rentres à quelle heure ?",
        "me",
    )
    assert body["read_at"] is None
    assert pushes == [
        {
            "title": "Antoine",
            "body": "Tu rentres à quelle heure ?",
            "data": {"kind": "messages", "screen": "messages"},
        }
    ]
    page = client_for(sam).get(LIST).json()
    assert [(m["text"], m["author"]) for m in page["results"]] == [
        ("Tu rentres à quelle heure ?", "you")
    ]


def test_discreet_partner(couples, pushes, django_capture_on_commit_callbacks) -> None:
    _, antoine, sam, *_ = couples
    NotificationPreference.objects.update_or_create(user=sam, defaults={"discreet": True})
    with django_capture_on_commit_callbacks(execute=True):
        client_for(antoine).post(LIST, {"text": "Surprise ce soir"}, format="json")
    assert pushes[0]["body"] == "Antoine t’a écrit."


def test_photo_and_voice_messages(couples, django_capture_on_commit_callbacks) -> None:
    couple, antoine, *_ = couples
    client = client_for(antoine)
    photo = client.post(
        LIST,
        {"kind": "photo", "media_key": uploaded(couple.pk, "jpg"), "width": 800, "height": 600},
        format="json",
    )
    assert photo.status_code == 201, photo.content
    assert photo.json()["media_url"] and photo.json()["width"] == 800
    voice = client.post(
        LIST,
        {
            "kind": "voice",
            "media_key": uploaded(couple.pk, "m4a"),
            "duration_ms": 4200,
            "waveform": [10, 55, 100, 30],
        },
        format="json",
    )
    assert voice.status_code == 201, voice.content
    assert voice.json()["duration_ms"] == 4200 and voice.json()["text"] == ""
    assert voice.json()["waveform"] == [10, 55, 100, 30]
    assert photo.json()["waveform"] == []


@pytest.mark.parametrize(
    "payload_factory",
    [
        lambda c, o: {"text": "   "},
        lambda c, o: {"kind": "photo", "media_key": "couples/999/messages/x.jpg"},
        lambda c, o: {"kind": "photo", "media_key": f"couples/{c}/memories/x.jpg"},
        lambda c, o: {"kind": "voice", "media_key": uploaded(c, "jpg")},
        lambda c, o: {"kind": "photo", "media_key": f"couples/{c}/messages/never-uploaded.jpg"},
        lambda c, o: {"kind": "photo", "media_key": uploaded(o, "jpg")},
        lambda c, o: {"text": "x" * 2001},
        lambda c, o: {"kind": "voice", "media_key": uploaded(c, "m4a"), "waveform": [101]},
        lambda c, o: {"kind": "voice", "media_key": uploaded(c, "m4a"), "waveform": [1] * 65},
    ],
)
def test_invalid_messages(couples, payload_factory) -> None:
    couple, antoine, _, other, _ = couples
    response = client_for(antoine).post(LIST, payload_factory(couple.pk, other.pk), format="json")
    assert response.status_code == 400
    assert not Message.objects.exists()


def test_upload_ticket_accepts_photos_and_voice_only(couples, monkeypatch) -> None:
    _, antoine, *_ = couples
    monkeypatch.setattr(
        storage,
        "_s3_client",
        lambda: type(
            "S3",
            (),
            {
                "generate_presigned_post": lambda self, **kw: {
                    "url": "https://s3.test",
                    "fields": {"key": kw["Key"]},
                }
            },
        )(),
    )
    client = client_for(antoine)
    voice = client.post(LIST + "upload-url/", {"content_type": "audio/mp4"}, format="json").json()
    assert voice["key"].endswith(".m4a") and voice["max_bytes"] == storage.MAX_AUDIO_BYTES
    photo = client.post(LIST + "upload-url/", {"content_type": "image/jpeg"}, format="json").json()
    assert photo["key"].endswith(".jpg")
    assert (
        client.post(LIST + "upload-url/", {"content_type": "video/mp4"}, format="json").status_code
        == 400
    )


def test_only_the_author_deletes_and_the_file_is_erased(
    couples, django_capture_on_commit_callbacks
) -> None:
    couple, antoine, sam, *_ = couples
    key = uploaded(couple.pk, "m4a")
    message = (
        client_for(antoine)
        .post(LIST, {"kind": "voice", "media_key": key, "duration_ms": 1000}, format="json")
        .json()
    )
    assert client_for(sam).delete(f"{LIST}{message['id']}/").status_code == 403
    with django_capture_on_commit_callbacks(execute=True):
        assert client_for(antoine).delete(f"{LIST}{message['id']}/").status_code == 204
    assert not default_storage.exists(key)


def test_strangers_get_nothing(couples) -> None:
    _, antoine, _, _, carol = couples
    message = client_for(antoine).post(LIST, {"text": "Rien que pour nous"}, format="json").json()
    c = client_for(carol)
    assert c.get(LIST).json()["results"] == []
    assert c.delete(f"{LIST}{message['id']}/").status_code == 404
    assert client_for(UserFactory()).get(LIST).status_code == 403
    assert APIClient().get(LIST).status_code == 401


def test_list_query_count(couples, django_assert_max_num_queries) -> None:
    _, antoine, *_ = couples
    client = client_for(antoine)
    for i in range(10):
        client.post(LIST, {"text": f"Message {i}"}, format="json")
    with django_assert_max_num_queries(6):
        page = client.get(LIST).json()
    assert [m["text"] for m in page["results"]][:2] == ["Message 9", "Message 8"]


def test_read_receipts_mark_only_the_partners_messages() -> None:
    _, alice, bob = make_couple()
    alice_api, bob_api = client_for(alice), client_for(bob)
    mine = alice_api.post(LIST, {"kind": "text", "text": "Coucou"}, format="json").json()
    theirs = bob_api.post(LIST, {"kind": "text", "text": "Salut"}, format="json").json()
    assert mine["read_at"] is None
    # Bob opens the conversation: Alice's message becomes read, his own does not.
    assert bob_api.post(f"{LIST}read/").status_code == 204
    by_id = {m["id"]: m for m in alice_api.get(LIST).json()["results"]}
    assert by_id[mine["id"]]["read_at"] is not None
    assert by_id[theirs["id"]]["read_at"] is None


def test_read_needs_a_couple_and_stays_inside_it() -> None:
    _, alice, _ = make_couple()
    _, carol, _ = make_couple()
    sent = client_for(alice).post(LIST, {"kind": "text", "text": "Privé"}, format="json").json()
    assert client_for(carol).post(f"{LIST}read/").status_code == 204
    assert Message.objects.get(pk=sent["id"]).read_at is None
    assert client_for(UserFactory()).post(f"{LIST}read/").status_code == 403
