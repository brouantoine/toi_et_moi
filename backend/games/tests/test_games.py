import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from couples.tests.factories import make_couple
from games.catalog import FIXED_OPTIONS, KINDS, QUESTIONS, TOPICS
from games.models import Answer

pytestmark = pytest.mark.django_db

HOME = "/api/v1/games/home/"
QUESTIONS_URL = "/api/v1/games/questions/"
ANSWERS = "/api/v1/games/answers/"
ADULT = "/api/v1/games/adult/"
NOTES = "/api/v1/notes/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def answer(user, question: str, **fields):
    return client_for(user).post(ANSWERS, {"question": question, **fields}, format="json")


def find(user, question: str) -> dict[str, object]:
    topic = question.rsplit("-", 1)[0]
    listed = client_for(user).get(QUESTIONS_URL, {"topic": topic}).json()
    return next(q for q in listed if q["id"] == question)


# --- catalogue -------------------------------------------------------------------


def test_catalogue_is_complete_and_bilingual() -> None:
    assert len(QUESTIONS) >= 290
    assert len({q.fr for q in QUESTIONS.values()}) == len(QUESTIONS)  # no duplicates
    for question in QUESTIONS.values():
        assert question.topic in TOPICS and question.kind in KINDS
        assert question.fr.strip() and question.en.strip()
        assert len(question.options_fr) == len(question.options_en)
        assert len(question.options_fr) == (0 if question.free_text else 2)
    for topic in TOPICS:
        assert sum(q.topic == topic for q in QUESTIONS.values()) >= 18
    assert set(FIXED_OPTIONS) <= set(KINDS)


# --- answering and revealing -------------------------------------------------------


def test_partner_answer_stays_hidden_until_i_answer() -> None:
    _, me, partner = make_couple()
    assert answer(partner, "warmup-1", choice=1).status_code == 201
    mine = find(me, "warmup-1")
    assert mine["state"] == "your_turn"
    assert mine["theirs"] is None and mine["match"] is None
    revealed = answer(me, "warmup-1", choice=1).json()
    assert revealed["state"] == "done"
    assert revealed["theirs"] == {"choice": 1, "text": ""}
    assert revealed["match"] is True
    assert find(partner, "warmup-1")["state"] == "done"


def test_most_likely_matches_when_both_point_at_the_same_person() -> None:
    _, me, partner = make_couple()
    question = next(q.id for q in QUESTIONS.values() if q.kind == "most_likely" and not q.adult)
    answer(me, question, choice=0)  # "me"
    assert answer(partner, question, choice=1).json()["match"] is True  # "you"


def test_free_text_and_validation() -> None:
    _, me, _ = make_couple()
    talk = next(q.id for q in QUESTIONS.values() if q.free_text and not q.adult)
    assert answer(me, talk, text="   ").json()["code"] == "text_required"
    assert answer(me, talk, text="  Notre voyage  ").json()["mine"]["text"] == "Notre voyage"
    assert answer(me, talk, text="Encore").json()["code"] == "already_answered"
    assert answer(me, "warmup-1", choice=5).json()["code"] == "invalid_choice"
    assert answer(me, "nope-1", choice=0).json()["code"] == "unknown_question"


def test_home_has_daily_pair_your_turn_and_progress() -> None:
    _, me, partner = make_couple()
    data = client_for(me).get(HOME).json()
    assert len(data["daily"]) == 2
    # Both partners get the same pair today.
    theirs = client_for(partner).get(HOME).json()
    assert [q["id"] for q in theirs["daily"]] == [q["id"] for q in data["daily"]]
    assert data["your_turn"] == [] and data["stats"]["answered_percent"] == 0
    answer(partner, "travel-1", choice=0)
    data = client_for(me).get(HOME).json()
    assert [q["id"] for q in data["your_turn"]] == ["travel-1"]
    assert data["your_turn_count"] == 1
    answer(me, "travel-1", choice=0)
    data = client_for(me).get(HOME).json()
    travel = next(t for t in data["topics"] if t["slug"] == "travel")
    assert (travel["done"], travel["total"]) == (1, 20) and travel["percent"] == 5
    assert data["stats"]["answered"] == 1
    assert {k["slug"] for k in data["kinds"]} == set(KINDS)


def test_adult_topic_needs_both_partners() -> None:
    _, me, partner = make_couple()
    home = client_for(me).get(HOME).json()
    intimacy = next(t for t in home["topics"] if t["slug"] == "intimacy")
    assert intimacy["locked"] is True
    assert client_for(me).get(QUESTIONS_URL, {"topic": "intimacy"}).json() == []
    assert answer(me, "intimacy-1", choice=0).json()["code"] == "locked"
    client_for(me).put(ADULT, {"enabled": True}, format="json")
    assert answer(me, "intimacy-1", choice=0).json()["code"] == "locked"  # only one of us
    data = client_for(partner).put(ADULT, {"enabled": True}, format="json").json()
    assert data["adult"] == {"mine": True, "partner": True}
    assert len(client_for(me).get(QUESTIONS_URL, {"topic": "intimacy"}).json()) == 20
    assert answer(me, "intimacy-1", choice=0).status_code == 201
    # Never proposed as a daily activity.
    assert all(not q["adult"] for q in client_for(me).get(HOME).json()["daily"])


def test_strangers_and_singles() -> None:
    _, me, _ = make_couple()
    _, stranger, _ = make_couple()
    answer(me, "food-1", choice=0)
    assert find(stranger, "food-1")["state"] == "new"
    assert Answer.objects.count() == 1
    lonely = client_for(UserFactory())
    assert lonely.get(HOME).status_code == 403
    assert (
        lonely.post(ANSWERS, {"question": "food-1", "choice": 0}, format="json").status_code == 403
    )
    assert APIClient().get(HOME).status_code == 401
    assert client_for(me).get(QUESTIONS_URL, {"topic": "nope"}).status_code == 400


# --- notes ---------------------------------------------------------------------


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


# --- streak ----------------------------------------------------------------------


def test_streak_counts_days_both_played_and_survives_until_tonight() -> None:
    from datetime import timedelta

    from django.utils import timezone

    _, me, partner = make_couple()
    assert client_for(me).get(HOME).json()["streak"] == {"count": 0, "today_done": False}

    def played(question: str, days_ago: int, users=(me, partner)) -> None:
        for user in users:
            answer(user, question, choice=0)
            Answer.objects.filter(user=user, question=question).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )

    played("travel-1", 2)
    played("travel-2", 1)
    # Not played today yet: the two previous days still count.
    assert client_for(me).get(HOME).json()["streak"] == {"count": 2, "today_done": False}
    played("food-1", 0, users=(me,))  # only one of us today: not a shared day yet
    assert client_for(me).get(HOME).json()["streak"]["today_done"] is False
    played("food-1", 0, users=(partner,))
    assert client_for(partner).get(HOME).json()["streak"] == {"count": 3, "today_done": True}


def test_streak_restarts_after_a_missed_day() -> None:
    from datetime import timedelta

    from django.utils import timezone

    _, me, partner = make_couple()
    for user in (me, partner):
        answer(user, "travel-1", choice=0)
    Answer.objects.update(created_at=timezone.now() - timedelta(days=3))
    assert client_for(me).get(HOME).json()["streak"] == {"count": 0, "today_done": False}
