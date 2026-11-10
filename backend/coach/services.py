"""The couple's shared AI coach: one thread both partners read, answered by Claude.

- On only when both partners turned it on, and only if the server has an API key.
- Messages are encrypted at rest; either partner can erase the whole thread.
- The call to Claude runs in a Celery task so the app never waits on it.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Literal

import anthropic
from anthropic.types.beta import (
    BetaAssistantMessageParam,
    BetaMessageParam,
    BetaUserMessageParam,
)
from django.conf import settings
from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import messages, prompts
from .models import CoachConsent, CoachMessage, CoachRole

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 40
MAX_TOKENS = 16000
THINKING_FOR = timedelta(minutes=3)
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class CoachError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def available() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def consented(user: User | None) -> bool:
    return bool(user and CoachConsent.objects.filter(user=user, enabled=True).exists())


def active(couple: Couple, user: User) -> bool:
    return consented(user) and consented(couple.partner_of(user))


def _author(message: CoachMessage, reader: User) -> str:
    if message.role != CoachRole.PARTNER:
        return str(message.role)
    return "me" if message.author_id == reader.pk else "you"


def thread(couple: Couple, user: User) -> dict[str, Any]:
    is_active = active(couple, user)
    stored = list(CoachMessage.objects.filter(couple=couple)) if is_active else []
    last = stored[-1] if stored else None
    return {
        "available": available(),
        "consent": {"mine": consented(user), "partner": consented(couple.partner_of(user))},
        "active": is_active,
        # The coach is writing: a partner spoke last, recently, and it can answer.
        "thinking": bool(
            last
            and last.role == CoachRole.PARTNER
            and available()
            and timezone.now() - last.created_at < THINKING_FOR
        ),
        "messages": [
            {
                "id": m.pk,
                "author": _author(m, user),
                "text": m.text,
                "created_at": m.created_at,
            }
            for m in stored
        ],
    }


def set_consent(couple: Couple, user: User, enabled: bool) -> None:
    CoachConsent.objects.update_or_create(user=user, defaults={"enabled": enabled})
    notify_changed(couple.pk, "coach", 0, "consent")


def post(couple: Couple, user: User, text: str) -> CoachMessage:
    text = text.strip()
    if not text:
        raise CoachError("empty")
    if not active(couple, user):
        raise CoachError("not_active")
    if not available():
        raise CoachError("unavailable")
    message = CoachMessage(couple=couple, author=user, role=CoachRole.PARTNER)
    message.text = text
    message.save()
    notify_changed(couple.pk, "coach", message.pk, "upsert")
    from .tasks import reply  # local import: tasks import this module

    reply.delay(couple.pk, message.pk)
    return message


def clear(couple: Couple) -> None:
    CoachMessage.objects.filter(couple=couple).delete()
    notify_changed(couple.pk, "coach", 0, "delete")


def build_messages(history: list[CoachMessage]) -> list[BetaMessageParam]:
    """Claude conversation: partners are the "user" side, each line prefixed by a name.

    Consecutive partner messages are merged into one turn; notices are left out.
    """
    turns: list[tuple[Literal["user", "assistant"], str]] = []
    for message in history:
        if message.role == CoachRole.NOTICE:
            continue
        role: Literal["user", "assistant"]
        if message.role == CoachRole.COACH:
            role, content = "assistant", message.text
        else:
            name = message.author.display_name if message.author else "?"
            role, content = "user", f"{name}: {message.text}"
        if not content.strip():
            continue
        if turns and turns[-1][0] == role:
            turns[-1] = (role, f"{turns[-1][1]}\n\n{content}")
        else:
            turns.append((role, content))
    # The API needs the conversation to start with a user turn.
    while turns and turns[0][0] != "user":
        turns.pop(0)
    result: list[BetaMessageParam] = []
    for role, content in turns:
        if role == "user":
            result.append(BetaUserMessageParam(role="user", content=content))
        else:
            result.append(BetaAssistantMessageParam(role="assistant", content=content))
    return result


def ask_claude(system: str, turns: list[BetaMessageParam]) -> str | None:
    """One Messages API call. Returns the reply text, or None when Claude declined."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.beta.messages.create(
        model=settings.COACH_MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=turns,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        # A request declined by a safety classifier is re-run on Anthropic's recommended
        # fallback model inside the same call.
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        return None
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    return text or None


def answer(couple_id: int, message_id: int) -> None:
    """Called by the Celery task: answer the thread unless it has moved on or been erased."""
    couple = Couple.objects.filter(pk=couple_id).first()
    trigger = CoachMessage.objects.filter(pk=message_id, couple_id=couple_id).first()
    if couple is None or trigger is None or not available():
        return
    latest = CoachMessage.objects.filter(couple=couple).last()
    if latest is None or latest.pk != trigger.pk:
        return  # someone wrote again: the task of the newest message answers both
    members = list(couple.members.all())
    if len(members) != 2 or not all(consented(member) for member in members):
        return
    history = list(
        CoachMessage.objects.filter(couple=couple)
        .select_related("author")
        .order_by("-created_at", "-id")[:HISTORY_LIMIT]
    )[::-1]
    language = trigger.author.language if trigger.author else "fr"
    system = prompts.system_prompt(members[0].display_name, members[1].display_name, language)
    reply = CoachMessage(couple=couple, role=CoachRole.COACH)
    try:
        text = ask_claude(system, build_messages(history))
    except anthropic.RateLimitError:
        logger.warning("coach: rate limited")
        text = None
    except anthropic.APIStatusError as error:
        logger.error("coach: API error %s", error.status_code)
        text = None
    except anthropic.APIConnectionError:
        logger.warning("coach: connection error")
        text = None
    if text is None:
        reply.role = CoachRole.NOTICE
        text = messages.text(language, "notice")
    reply.text = text
    reply.save()
    notify_changed(couple.pk, "coach", reply.pk, "upsert")
    if reply.role == CoachRole.COACH:
        for member in members:
            discreet = preference_for(member).discreet
            title = (
                "Bolingo"
                if discreet
                else ("Le coach a répondu" if member.language != "en" else "The coach replied")
            )
            body = "" if discreet else text[:140]
            notify(member, Kind.MESSAGES, title, body, {"screen": "coach"})
