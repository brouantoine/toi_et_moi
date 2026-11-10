"""Questions and games: answer each on your own, discover both answers together.

The partner's answer is NEVER shown before you have answered yourself. Adults-only
topics appear only when both partners turned them on. A gentle day streak counts the
days you both played (allowed by the owner, see docs/DECISIONS.md); no score.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any

from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import messages
from .catalog import KINDS, QUESTIONS, TOPICS, Question
from .models import Answer, GamePreference, Note

DAILY_COUNT = 2
YOUR_TURN_LIMIT = 10


class GameError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def adult_enabled(user: User) -> bool:
    return GamePreference.objects.filter(user=user, adult=True).exists()


def adult_unlocked(couple: Couple, user: User) -> bool:
    partner = couple.partner_of(user)
    return bool(partner and adult_enabled(user) and adult_enabled(partner))


def _visible(couple: Couple, user: User) -> list[Question]:
    unlocked = adult_unlocked(couple, user)
    return [q for q in QUESTIONS.values() if unlocked or not q.adult]


def _answers(couple: Couple) -> dict[str, dict[int, Answer]]:
    by_question: dict[str, dict[int, Answer]] = {}
    for answer in Answer.objects.filter(couple=couple):
        by_question.setdefault(answer.question, {})[answer.user_id] = answer
    return by_question


def _matches(question: Question, mine: Answer, theirs: Answer) -> bool | None:
    if question.free_text:
        return None
    if question.kind == "most_likely":
        # "Me" from one side and "You" from the other point at the same person.
        return mine.choice != theirs.choice
    return mine.choice == theirs.choice


def _answer_payload(answer: Answer) -> dict[str, Any]:
    return {"choice": answer.choice, "text": answer.text}


def question_payload(
    question: Question, user: User, partner: User | None, given: dict[int, Answer]
) -> dict[str, Any]:
    mine = given.get(user.pk)
    theirs = given.get(partner.pk) if partner else None
    if mine and theirs:
        state = "done"
    elif mine:
        state = "waiting"
    elif theirs:
        state = "your_turn"
    else:
        state = "new"
    return {
        "id": question.id,
        "topic": question.topic,
        "kind": question.kind,
        "text": question.text(user.language),
        "options": list(question.options(user.language)),
        "adult": question.adult,
        "state": state,
        "mine": _answer_payload(mine) if mine else None,
        # Never before I answered myself.
        "theirs": _answer_payload(theirs) if mine and theirs else None,
        "match": _matches(question, mine, theirs) if mine and theirs else None,
    }


def questions(
    couple: Couple, user: User, topic: str | None = None, kind: str | None = None
) -> list[dict[str, Any]]:
    partner = couple.partner_of(user)
    given = _answers(couple)
    return [
        question_payload(q, user, partner, given.get(q.id, {}))
        for q in _visible(couple, user)
        if (topic is None or q.topic == topic) and (kind is None or q.kind == kind)
    ]


def _daily(
    couple: Couple, user: User, day: date, given: dict[str, dict[int, Answer]]
) -> list[Question]:
    """The same two questions for both partners all day, among those not finished yet."""
    pool = [q for q in _visible(couple, user) if not q.adult and len(given.get(q.id, {})) < 2]
    # Questions answered today stay in today's pair so the reveal remains on the home.
    today = [
        q
        for q in _visible(couple, user)
        if not q.adult
        and any(timezone.localdate(a.created_at) == day for a in given.get(q.id, {}).values())
    ]
    rng = random.Random(f"{couple.pk}:{day.isoformat()}")  # noqa: S311 - not security
    picked = rng.sample(pool, min(DAILY_COUNT, len(pool)))
    merged = list(dict.fromkeys([*today, *picked]))
    return merged[:DAILY_COUNT]


def streak(couple: Couple, user: User, today: date) -> dict[str, Any]:
    """Days in a row on which BOTH partners answered at least one question.

    Today not played yet does not break the streak: it still counts up to yesterday.
    """
    partner = couple.partner_of(user)
    days: dict[int, set[date]] = {}
    for user_id, created_at in Answer.objects.filter(couple=couple).values_list(
        "user_id", "created_at"
    ):
        days.setdefault(user_id, set()).add(timezone.localdate(created_at))
    both = days.get(user.pk, set()) & days.get(partner.pk, set()) if partner else set()
    today_done = today in both
    cursor = today if today_done else today - timedelta(days=1)
    count = 0
    while cursor in both:
        count += 1
        cursor -= timedelta(days=1)
    return {"count": count, "today_done": today_done}


def home(couple: Couple, user: User) -> dict[str, Any]:
    partner = couple.partner_of(user)
    given = _answers(couple)
    visible = _visible(couple, user)

    def payload(q: Question) -> dict[str, Any]:
        return question_payload(q, user, partner, given.get(q.id, {}))

    your_turn = [
        q
        for q in visible
        if partner and partner.pk in given.get(q.id, {}) and user.pk not in given.get(q.id, {})
    ]
    done = sum(1 for q in visible if len(given.get(q.id, {})) == 2)
    topics = []
    for slug, (fr, en, adult) in TOPICS.items():
        of_topic = [q for q in QUESTIONS.values() if q.topic == slug]
        finished = sum(1 for q in of_topic if len(given.get(q.id, {})) == 2)
        topics.append(
            {
                "slug": slug,
                "name": en if user.language == "en" else fr,
                "adult": adult,
                "locked": adult and not adult_unlocked(couple, user),
                "total": len(of_topic),
                "done": finished,
                "percent": round(100 * finished / len(of_topic)) if of_topic else 0,
            }
        )
    kinds = [
        {
            "slug": slug,
            "name": en if user.language == "en" else fr,
            "total": sum(1 for q in visible if q.kind == slug),
        }
        for slug, (fr, en) in KINDS.items()
    ]
    return {
        "daily": [payload(q) for q in _daily(couple, user, timezone.localdate(), given)],
        "your_turn": [payload(q) for q in your_turn[:YOUR_TURN_LIMIT]],
        "your_turn_count": len(your_turn),
        "topics": topics,
        "kinds": kinds,
        "adult": {
            "mine": adult_enabled(user),
            "partner": bool(partner and adult_enabled(partner)),
        },
        "stats": stats(couple, done, len(visible)),
        "streak": streak(couple, user, timezone.localdate()),
    }


def stats(couple: Couple, done: int, total: int) -> dict[str, Any]:
    from memories.models import Memory
    from messaging.models import Message
    from organization.models import Event

    days = (timezone.localdate() - couple.start_date).days if couple.start_date else None
    return {
        "days_together": days,
        "answered_percent": round(100 * done / total) if total else 0,
        "answered": done,
        "memories": Memory.objects.filter(couple=couple).count(),
        "events": Event.objects.filter(couple=couple).count(),
        "messages": Message.objects.filter(couple=couple).count(),
        "notes": Note.objects.filter(couple=couple).count(),
    }


def answer(
    couple: Couple, user: User, question_id: str, choice: int | None, text: str
) -> dict[str, Any]:
    question = QUESTIONS.get(question_id)
    if question is None:
        raise GameError("unknown_question")
    if question.adult and not adult_unlocked(couple, user):
        raise GameError("locked")
    text = text.strip()
    if question.free_text:
        if not text:
            raise GameError("text_required")
        choice = None
    else:
        if choice is None or not 0 <= choice < len(question.options_fr):
            raise GameError("invalid_choice")
        text = ""
    _, created = Answer.objects.get_or_create(
        couple=couple, user=user, question=question_id, defaults={"choice": choice, "text": text}
    )
    if not created:
        raise GameError("already_answered")
    partner = couple.partner_of(user)
    given = _answers(couple).get(question_id, {})
    notify_changed(couple.pk, "games", 0, "answered")
    if partner is not None:
        both = partner.pk in given
        discreet = preference_for(partner).discreet
        key = "revealed" if both else "your_turn"
        notify(
            partner,
            Kind.DAILY_QUESTION,
            messages.text(
                partner.language,
                "discreet_title" if discreet else f"{key}_title",
                name=user.display_name,
            ),
            messages.text(partner.language, "discreet_body" if discreet else f"{key}_body"),
            {"screen": "games", "question": question_id},
        )
    return question_payload(question, user, partner, given)


def set_adult(couple: Couple, user: User, enabled: bool) -> None:
    GamePreference.objects.update_or_create(user=user, defaults={"adult": enabled})
    notify_changed(couple.pk, "games", 0, "preferences")
