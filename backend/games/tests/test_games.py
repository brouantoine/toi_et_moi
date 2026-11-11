from pathlib import Path
from typing import Any

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from core import storage
from couples.tests.factories import make_couple
from games import catalog, services
from games.models import Answer

pytestmark = pytest.mark.django_db

HOME = "/api/v1/games/home/"
PACKS = "/api/v1/games/packs/"
ANSWERS = "/api/v1/games/answers/"
ADULT = "/api/v1/games/adult/"
UPLOAD = "/api/v1/games/upload-url/"
NOTES = "/api/v1/notes/"

FIXTURES = catalog.load(Path(__file__).parent / "content")


@pytest.fixture(autouse=True)
def small_catalogue(monkeypatch):
    """Behaviour tests run on a tiny catalogue; the real one is checked on its own."""
    monkeypatch.setattr(catalog, "catalogue", lambda: FIXTURES)
    monkeypatch.setattr(services, "catalogue", lambda: FIXTURES)


@pytest.fixture
def pushes(monkeypatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        services,
        "notify",
        lambda user, kind, title, body, data: calls.append(
            {"to": user.pk, "title": title, "data": data}
        ),
    )
    return calls


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def answer(user, item: str, **fields):
    return client_for(user).post(ANSWERS, {"question": item, **fields}, format="json")


def pack(user, pack_id: str) -> dict[str, Any]:
    data: dict[str, Any] = client_for(user).get(f"{PACKS}{pack_id}/").json()
    return data


def play(user, pack_id: str, choice: int = 0) -> None:
    for item in pack(user, pack_id)["items"]:
        if item["mine"] is None:
            assert answer(user, item["id"], choice=choice).status_code == 201


# --- the real catalogue -------------------------------------------------------------


def test_real_catalogue_is_rich_bilingual_and_illustrated() -> None:
    packs = catalog.load()
    assert len(packs) >= 120
    assert sum(len(p.items) for p in packs.values()) >= 1200
    static = Path(catalog.__file__).parent / "static"
    texts: set[str] = set()
    for p in packs.values():
        assert p.kind in catalog.KINDS and p.topics and set(p.topics) <= set(catalog.TOPICS)
        assert set(p.tags) <= set(catalog.TAGS)
        assert ("intimacy" in p.topics) == p.adult
        assert p.title_fr and p.title_en and 6 <= len(p.items) <= 12
        assert (static / catalog.art_path(p.art)).exists(), p.art
        for entry in p.items:
            if p.kind not in {"rather", "this_or_that"}:
                assert entry.fr and entry.en
                assert entry.fr not in texts, entry.fr
                texts.add(entry.fr)
            for option in entry.options:
                assert option.fr and option.en
                if option.art:
                    assert (static / catalog.art_path(option.art)).exists(), option.art
    for kind in catalog.KINDS:
        assert sum(p.kind == kind for p in packs.values()) >= 6, kind
    assert not any(p.adult for p in packs.values() if p.kind == "photo")


def test_art_names_become_file_names() -> None:
    assert catalog.art_slug("Face with tears of joy") == "face-with-tears-of-joy"
    assert catalog.art_path("1st place medal") == "games/art/1st-place-medal.webp"


# --- playing a pack ------------------------------------------------------------------


def test_partner_answers_stay_hidden_until_i_answer_the_same_item(pushes) -> None:
    _, me, partner = make_couple()
    play(partner, "daily-life", choice=1)
    seen = pack(me, "daily-life")
    assert seen["state"] == "your_turn" and (seen["mine"], seen["theirs"]) == (0, 3)
    first = seen["items"][0]
    assert first["partner_answered"] is True and first["theirs"] is None
    revealed = answer(me, first["id"], choice=1).json()
    assert revealed["theirs"]["choice"] == 1 and revealed["match"] is True
    assert pack(me, "daily-life")["items"][1]["theirs"] is None  # not answered yet
    # Still my turn (the partner finished), now with a game in progress.
    assert (pack(me, "daily-life")["state"], pack(me, "daily-life")["mine"]) == ("your_turn", 1)
    _, alone, _ = make_couple()
    answer(alone, "daily-life.1", choice=0)
    assert pack(alone, "daily-life")["state"] == "in_progress"


def test_results_and_similarity_once_both_finished(pushes) -> None:
    _, me, partner = make_couple()
    play(me, "daily-life", choice=0)
    assert pack(me, "daily-life")["state"] == "waiting"
    assert pack(me, "daily-life")["similarity"] is None
    items = pack(partner, "daily-life")["items"]
    answer(partner, items[0]["id"], choice=0)
    answer(partner, items[1]["id"], choice=1)
    answer(partner, items[2]["id"], skipped=True)
    result = pack(me, "daily-life")
    assert result["state"] == "done"
    assert result["similarity"] == 50  # the skipped item is not compared
    assert [i["match"] for i in result["items"]] == [True, False, None]
    # One push per finished pack, not one per item.
    assert [(p["to"], p["data"]["pack"]) for p in pushes] == [
        (partner.pk, "daily-life"),
        (me.pk, "daily-life"),
    ]


def test_most_likely_matches_when_both_point_at_the_same_person() -> None:
    _, me, partner = make_couple()
    answer(me, "who-cooks.1", choice=0)  # "me"
    assert answer(partner, "who-cooks.1", choice=1).json()["match"] is True  # "you"


def test_two_illustrated_options_for_would_you_rather() -> None:
    _, me, _ = make_couple()
    item = pack(me, "travel-dilemmas")["items"][0]
    assert [o["name"] for o in item["options"]] == ["Partir loin", "Rester près"]
    assert item["options"][0]["art"].endswith("/static/games/art/airplane.webp")
    assert pack(me, "daily-life")["items"][0]["options"][1] == {"name": "J’ai déjà !", "art": None}
    english = UserFactory(language="en")
    _, en, _ = make_couple(english)
    assert pack(en, "travel-dilemmas")["title"] == "Travels"


def test_each_kind_checks_its_own_answer() -> None:
    _, me, _ = make_couple()
    assert answer(me, "heart-to-heart.1", text="   ").json()["code"] == "text_required"
    ok = answer(me, "heart-to-heart.1", text="  Notre voyage  ").json()
    assert ok["mine"]["text"] == "Notre voyage"
    assert answer(me, "heart-to-heart.1", text="Encore").json()["code"] == "already_answered"
    assert answer(me, "daily-life.1", choice=5).json()["code"] == "invalid_choice"
    assert answer(me, "nope.1", choice=0).json()["code"] == "unknown_question"
    assert answer(me, "daily-life.9", choice=0).json()["code"] == "unknown_question"
    assert answer(me, "heart-to-heart.2", skipped=True).json()["mine"]["skipped"] is True


@pytest.mark.parametrize(
    "drawing",
    [
        [],
        [{"c": 9, "w": 4, "p": [1, 2]}],
        [{"c": 0, "w": 4, "p": [1]}],
        [{"c": 0, "w": 4, "p": [1, 2000]}],
        [{"c": 0, "w": 99, "p": [1, 2]}],
    ],
)
def test_drawings_are_bounded(drawing) -> None:
    _, me, _ = make_couple()
    assert answer(me, "funny-animals.1", drawing=drawing).json()["code"] == "invalid_drawing"
    assert answer(me, "funny-animals.1", drawing=["stroke"]).status_code == 400


def test_drawing_answer_is_kept_and_revealed() -> None:
    _, me, partner = make_couple()
    strokes = [{"c": 2, "w": 6, "p": [10, 20, 30, 40, 50, 60]}]
    assert answer(me, "funny-animals.1", drawing=strokes).status_code == 201
    revealed = answer(partner, "funny-animals.1", drawing=strokes).json()
    assert revealed["theirs"]["drawing"] == strokes and revealed["match"] is None


def test_photo_answer_must_be_uploaded_in_the_couple_space() -> None:
    couple, me, _ = make_couple()
    other, *_ = make_couple()
    key = f"couples/{couple.pk}/games/abc.jpg"
    assert answer(me, "our-story-pics.1", media_key=key).json()["code"] == "upload_missing"
    stranger_key = f"couples/{other.pk}/games/abc.jpg"
    default_storage.save(stranger_key, ContentFile(b"x"))
    assert answer(me, "our-story-pics.1", media_key=stranger_key).json()["code"] == "invalid_key"
    default_storage.save(key, ContentFile(b"jpeg"))
    sent = answer(me, "our-story-pics.1", media_key=key).json()
    assert sent["mine"]["photo_url"]


def test_photo_upload_ticket(monkeypatch) -> None:
    _, me, _ = make_couple()
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
    ticket = client_for(me).post(UPLOAD, {"content_type": "image/jpeg"}, format="json").json()
    assert "/games/" in ticket["key"] and ticket["key"].endswith(".jpg")
    refused = client_for(me).post(UPLOAD, {"content_type": "video/mp4"}, format="json")
    assert refused.status_code == 400


# --- lists and home ------------------------------------------------------------------


def test_lists_filter_by_kind_topic_state_and_search() -> None:
    _, me, partner = make_couple()
    ids = lambda **params: [p["id"] for p in client_for(me).get(PACKS, params).json()["packs"]]  # noqa: E731
    assert ids(kind="never") == ["daily-life", "party-time"]
    assert ids(topic="travel") == ["travel-dilemmas"]
    assert ids(q="SOIREE") == ["party-time"]  # accents and case do not matter
    play(partner, "party-time")
    assert ids(state="your_turn") == ["party-time"]
    play(me, "who-cooks")
    assert ids(state="waiting") == ["who-cooks"]
    assert "who-cooks" not in ids(state="unanswered")
    assert client_for(me).get(PACKS, {"kind": "poker"}).status_code == 400
    assert client_for(me).get(PACKS, {"state": "lost"}).status_code == 400


def test_home_has_daily_packs_your_turn_and_progress() -> None:
    _, me, partner = make_couple()
    data = client_for(me).get(HOME).json()
    assert len(data["daily"]) == 2
    theirs = client_for(partner).get(HOME).json()
    assert [p["id"] for p in theirs["daily"]] == [p["id"] for p in data["daily"]]
    assert data["your_turn"] == [] and data["stats"]["answered_percent"] == 0
    play(partner, "who-cooks")
    data = client_for(me).get(HOME).json()
    assert [p["id"] for p in data["your_turn"]] == ["who-cooks"]
    assert data["your_turn_count"] == 1
    play(me, "who-cooks")
    data = client_for(me).get(HOME).json()
    food = next(t for t in data["topics"] if t["slug"] == "food")
    assert (food["done"], food["total"], food["percent"]) == (1, 1, 100)
    assert data["done_count"] == 1 and data["stats"]["answered"] == 1
    assert [k["slug"] for k in data["kinds"]] == [
        "most_likely",
        "draw",
        "never",
        "rather",
        "conversation",
        "photo",
    ]
    assert data["daily"][0]["art"].startswith("http://testserver/static/games/art/")


def test_adult_packs_need_both_partners() -> None:
    _, me, partner = make_couple()
    topics = {t["slug"]: t for t in client_for(me).get(HOME).json()["topics"]}
    assert topics["intimacy"]["locked"] is True
    assert topics["fun"]["total"] == 2  # the 18+ pack filed under "fun" too stays out
    listed = client_for(me).get(PACKS, {"kind": "never"}).json()
    assert "spicy-never" not in [p["id"] for p in listed["packs"]]
    assert listed["adult_hidden"] == 1
    assert client_for(me).get(f"{PACKS}spicy-never/").status_code == 404
    assert answer(me, "spicy-never.1", choice=0).json()["code"] == "locked"
    client_for(me).put(ADULT, {"enabled": True}, format="json")
    assert answer(me, "spicy-never.1", choice=0).json()["code"] == "locked"  # only one of us
    data = client_for(partner).put(ADULT, {"enabled": True}, format="json").json()
    assert data["adult"] == {"mine": True, "partner": True}
    listed = client_for(me).get(PACKS, {"kind": "never"}).json()
    assert listed["adult_hidden"] == 0 and len(listed["packs"]) == 3
    tags = next(p for p in listed["packs"] if p["id"] == "spicy-never")["tags"]
    assert tags == [{"slug": "adult", "name": "18+"}]
    assert answer(me, "spicy-never.1", choice=0).status_code == 201
    topics = {t["slug"]: t for t in client_for(me).get(HOME).json()["topics"]}
    assert topics["fun"]["total"] == 3
    assert all(not p["adult"] for p in client_for(me).get(HOME).json()["daily"])


def test_premium_packs_lock_only_once_enforced(settings, monkeypatch) -> None:
    _, me, _ = make_couple()
    monkeypatch.setattr(services, "FREE_PACKS_PER_KIND", 1)
    assert pack(me, "party-time")["premium"] is True
    assert pack(me, "party-time")["locked"] is False
    settings.GAMES_PREMIUM_ENFORCED = True
    assert pack(me, "party-time")["locked"] is True
    assert answer(me, "party-time.1", choice=0).json()["code"] == "premium"
    assert answer(me, "daily-life.1", choice=0).status_code == 201


def test_strangers_and_singles() -> None:
    _, me, _ = make_couple()
    _, stranger, _ = make_couple()
    answer(me, "who-cooks.1", choice=0)
    assert pack(stranger, "who-cooks")["state"] == "new"
    assert Answer.objects.count() == 1
    lonely = client_for(UserFactory())
    assert lonely.get(HOME).status_code == 403
    assert lonely.get(PACKS).status_code == 403
    assert answer(UserFactory(), "who-cooks.1", choice=0).status_code == 403
    assert APIClient().get(HOME).status_code == 401
    assert client_for(me).get(f"{PACKS}nope/").status_code == 404


# --- notes ---------------------------------------------------------------------------


def test_notes_are_shared_and_only_the_author_removes() -> None:
    _, me, partner = make_couple()
    _, stranger, _ = make_couple()
    created = client_for(me).post(
        NOTES, {"text": "Acheter des fleurs", "color": "sage"}, format="json"
    )
    assert created.status_code == 201 and created.json()["author"] == "me"
    listed = client_for(partner).get(NOTES).json()
    assert [(n["text"], n["author"]) for n in listed] == [("Acheter des fleurs", "you")]
    assert client_for(stranger).get(NOTES).json() == []
    note = f"{NOTES}{created.json()['id']}/"
    assert client_for(stranger).delete(note).status_code == 404
    assert client_for(partner).delete(note).status_code == 403
    assert client_for(me).delete(note).status_code == 204
    assert (
        client_for(me).post(NOTES, {"text": "x", "color": "pink"}, format="json").status_code == 400
    )


# --- streak --------------------------------------------------------------------------


def test_streak_counts_days_both_played_and_survives_until_tonight() -> None:
    from datetime import timedelta

    from django.utils import timezone

    _, me, partner = make_couple()
    assert client_for(me).get(HOME).json()["streak"] == {"count": 0, "today_done": False}

    def played(item: str, days_ago: int, users=(me, partner)) -> None:
        for user in users:
            answer(user, item, choice=0)
            Answer.objects.filter(user=user, question=item).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )

    played("daily-life.1", 2)
    played("daily-life.2", 1)
    # Not played today yet: the two previous days still count.
    assert client_for(me).get(HOME).json()["streak"] == {"count": 2, "today_done": False}
    played("daily-life.3", 0, users=(me,))  # only one of us today: not a shared day yet
    assert client_for(me).get(HOME).json()["streak"]["today_done"] is False
    played("daily-life.3", 0, users=(partner,))
    assert client_for(partner).get(HOME).json()["streak"] == {"count": 3, "today_done": True}


def test_streak_restarts_after_a_missed_day() -> None:
    from datetime import timedelta

    from django.utils import timezone

    _, me, partner = make_couple()
    for user in (me, partner):
        answer(user, "daily-life.1", choice=0)
    Answer.objects.update(created_at=timezone.now() - timedelta(days=3))
    assert client_for(me).get(HOME).json()["streak"] == {"count": 0, "today_done": False}
