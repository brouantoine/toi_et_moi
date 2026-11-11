"""The couple's shared AI coach: one thread both partners read, answered by Claude.

- On only when both partners turned it on, and only if the server has an API key.
- Messages are encrypted at rest; either partner can erase the whole thread.
- The call to Claude runs in a Celery task so the app never waits on it.
"""

from __future__ import annotations

import http.client
import json
import logging
import socket
import ssl
import urllib.error
import urllib.request
from datetime import timedelta
from typing import Any, Literal

import anthropic
from anthropic.types.beta import (
    BetaAssistantMessageParam,
    BetaMessageParam,
    BetaTextBlockParam,
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
from .models import CoachConsent, CoachMessage, CoachRole, CoachTrial

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 40
MAX_TOKENS = 16000
THINKING_FOR = timedelta(minutes=3)
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class CoachError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


OPENROUTER_TIMEOUT = 90
OPENROUTER_MAX_TOKENS = 2000
OPENROUTER_ATTEMPTS = 2


def available() -> bool:
    return bool(settings.OPENROUTER_API_KEY or settings.ANTHROPIC_API_KEY)


def consented(user: User | None) -> bool:
    return bool(user and CoachConsent.objects.filter(user=user, enabled=True).exists())


def active(couple: Couple, user: User) -> bool:
    return consented(user) and consented(couple.partner_of(user))


def access(couple: Couple) -> dict[str, Any]:
    """Free month from the first time the coach opened for both, then Bolingo Plus.

    state: "plus" (subscribed), "trial" (free month running or not started yet),
    "expired" (free month over, Plus needed).
    """
    if couple.premium:
        return {"state": "plus", "trial_ends_at": None, "days_left": None}
    trial = CoachTrial.objects.filter(couple=couple).first()
    days = settings.COACH_TRIAL_DAYS
    if trial is None:
        return {"state": "trial", "trial_ends_at": None, "days_left": days}
    ends = trial.started_at + timedelta(days=days)
    remaining = ends - timezone.now()
    if remaining.total_seconds() <= 0:
        return {"state": "expired", "trial_ends_at": ends, "days_left": 0}
    # A started day counts as a day left: "1 day left" until the very end.
    days_left = remaining.days + (1 if remaining.seconds or remaining.microseconds else 0)
    return {"state": "trial", "trial_ends_at": ends, "days_left": days_left}


def allowed(couple: Couple) -> bool:
    return bool(access(couple)["state"] != "expired")


def _author(message: CoachMessage, reader: User) -> str:
    if message.role != CoachRole.PARTNER:
        return str(message.role)
    return "me" if message.author_id == reader.pk else "you"


def thread(couple: Couple, user: User) -> dict[str, Any]:
    is_active = active(couple, user)
    if is_active:
        # Couples who turned the coach on before the free month existed start it now.
        CoachTrial.objects.get_or_create(couple=couple)
    stored = list(CoachMessage.objects.filter(couple=couple)) if is_active else []
    last = stored[-1] if stored else None
    return {
        "available": available(),
        "consent": {"mine": consented(user), "partner": consented(couple.partner_of(user))},
        "active": is_active,
        "access": access(couple),
        # The coach is writing: a partner spoke last, recently, and it can answer.
        "thinking": bool(
            last
            and last.role == CoachRole.PARTNER
            and available()
            and allowed(couple)
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
    if active(couple, user):
        # The free month starts the first time the coach opens for both of you.
        CoachTrial.objects.get_or_create(couple=couple)
    notify_changed(couple.pk, "coach", 0, "consent")


def post(couple: Couple, user: User, text: str) -> CoachMessage:
    text = text.strip()
    if not text:
        raise CoachError("empty")
    if not active(couple, user):
        raise CoachError("not_active")
    if not available():
        raise CoachError("unavailable")
    if not allowed(couple):
        raise CoachError("plus_required")
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


def ask_claude(system: list[BetaTextBlockParam], turns: list[BetaMessageParam]) -> str | None:
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


class _IPv4HTTPSConnection(http.client.HTTPSConnection):
    """HTTPS over IPv4 only: on some networks the IPv6 path drops large requests (the
    coach's charter alone is about 40 KB), while IPv4 works everywhere OpenRouter does."""

    def connect(self) -> None:
        family, kind, proto, _, address = socket.getaddrinfo(
            self.host, self.port, socket.AF_INET, socket.SOCK_STREAM
        )[0]
        raw = socket.socket(family, kind, proto)
        raw.settimeout(self.timeout)
        raw.connect(address)
        context = ssl.create_default_context()
        self.sock = context.wrap_socket(raw, server_hostname=self.host)


class _IPv4HTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, req: urllib.request.Request) -> http.client.HTTPResponse:
        return self.do_open(_IPv4HTTPSConnection, req)


_OPENER = urllib.request.build_opener(_IPv4HTTPSHandler)


def _post_json(request: urllib.request.Request) -> dict[str, Any]:
    with _OPENER.open(request, timeout=OPENROUTER_TIMEOUT) as response:
        data: dict[str, Any] = json.load(response)
    return data


def _plain(content: object) -> str:
    """Text of a message param, whatever its shape (string or list of text blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(b.get("text", "")) for b in content if isinstance(b, dict))
    return ""


def ask_openrouter(system: list[BetaTextBlockParam], turns: list[BetaMessageParam]) -> str | None:
    """One chat completion through OpenRouter. Returns the reply text, or None on failure.

    Same contract as ask_claude: the charter then this couple's session as the system
    message, then this couple's thread only.
    """
    messages = [{"role": "system", "content": "\n\n".join(block["text"] for block in system)}]
    messages += [{"role": turn["role"], "content": _plain(turn["content"])} for turn in turns]
    body = json.dumps(
        {
            "model": settings.OPENROUTER_MODEL,
            "messages": messages,
            "max_tokens": OPENROUTER_MAX_TOKENS,
        }
    ).encode()
    request = urllib.request.Request(  # noqa: S310 - fixed https endpoint from settings
        f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "X-Title": "Bolingo",
            # Cloudflare in front of OpenRouter drops the default "Python-urllib" agent.
            "User-Agent": "Bolingo-coach/1.0",
        },
        method="POST",
    )
    data: dict[str, Any] | None = None
    for attempt in range(OPENROUTER_ATTEMPTS):
        try:
            data = _post_json(request)
            break
        except urllib.error.HTTPError as error:
            logger.error("coach: OpenRouter HTTP %s", error.code)
            return None
        except (OSError, http.client.HTTPException, json.JSONDecodeError):
            # Dropped connection or timeout: worth one more try.
            logger.warning("coach: OpenRouter unreachable (attempt %s)", attempt + 1)
    if data is None:
        return None
    choices = data.get("choices") or []
    if not choices or choices[0].get("finish_reason") == "content_filter":
        return None
    text = str((choices[0].get("message") or {}).get("content") or "").strip()
    return text or None


def ask_model(system: list[BetaTextBlockParam], turns: list[BetaMessageParam]) -> str | None:
    """OpenRouter when its key is set, otherwise the Claude API."""
    if settings.OPENROUTER_API_KEY:
        return ask_openrouter(system, turns)
    return ask_claude(system, turns)


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
    if not allowed(couple):
        return  # the free month ended while the message was waiting
    history = list(
        CoachMessage.objects.filter(couple=couple)
        .select_related("author")
        .order_by("-created_at", "-id")[:HISTORY_LIMIT]
    )[::-1]
    # Each couple is an island: nothing from another thread may ever reach the model.
    member_ids = {member.pk for member in members}
    if any(
        m.couple_id != couple.pk or (m.author_id is not None and m.author_id not in member_ids)
        for m in history
    ):
        logger.error("coach: foreign message in thread of couple %s, not answered", couple.pk)
        return
    language = trigger.author.language if trigger.author else "fr"
    system = prompts.system_blocks(members[0].display_name, members[1].display_name, language)
    reply = CoachMessage(couple=couple, role=CoachRole.COACH)
    try:
        text = ask_model(system, build_messages(history))
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
