"""Push sending through Expo, with every safeguard in one place.

`notify(user, kind, ...)` is the only entry point. It checks the person's preference for
that kind and their quiet hours (in their own time zone), sends to all their phones via a
Celery task, and forgets tokens Expo reports as gone.
"""

from __future__ import annotations

import json
import logging
import urllib.request
from collections.abc import Iterable
from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.utils import timezone

from accounts.models import User

from .models import NotificationPreference, PushDevice

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
ANDROID_CHANNEL = "default"


def preference_for(user: User) -> NotificationPreference:
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref


def local_now(user: User, now: datetime | None = None) -> datetime:
    try:
        tz = ZoneInfo(user.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo("UTC")
    return (now or timezone.now()).astimezone(tz)


def in_quiet_hours(user: User, now: datetime | None = None) -> bool:
    """Quiet hours may cross midnight (e.g. 22:00 -> 08:00)."""
    start, end = user.quiet_hours_start, user.quiet_hours_end
    if start is None or end is None or start == end:
        return False
    current: time = local_now(user, now).time()
    if start < end:
        return start <= current < end
    return current >= start or current < end


def notify(
    user: User,
    kind: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    category: str | None = None,
    respect_quiet_hours: bool = True,
) -> bool:
    """Queues a push to all the person's phones. Returns False when nothing is sent."""
    if not preference_for(user).allows(kind):
        return False
    if respect_quiet_hours and in_quiet_hours(user):
        return False
    tokens = list(PushDevice.objects.filter(user=user).values_list("token", flat=True))
    if not tokens:
        return False
    from .tasks import send_push  # local import: tasks import this module

    send_push.delay(tokens, title, body, {"kind": kind, **(data or {})}, category)
    return True


def build_messages(
    tokens: Iterable[str], title: str, body: str, data: dict[str, Any], category: str | None
) -> list[dict[str, Any]]:
    messages = []
    for token in tokens:
        message: dict[str, Any] = {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "channelId": ANDROID_CHANNEL,
        }
        if category:
            message["categoryId"] = category
        messages.append(message)
    return messages


def post_to_expo(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """POSTs to the Expo push API and returns the per-message tickets."""
    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            **(
                {"Authorization": f"Bearer {settings.EXPO_ACCESS_TOKEN}"}
                if getattr(settings, "EXPO_ACCESS_TOKEN", "")
                else {}
            ),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310
        payload = json.loads(response.read().decode())
    tickets: list[dict[str, Any]] = payload.get("data", [])
    return tickets


def forget_gone_tokens(tokens: list[str], tickets: list[dict[str, Any]]) -> int:
    """Deletes tokens Expo reports as no longer registered (app removed, etc.)."""
    gone = [
        token
        for token, ticket in zip(tokens, tickets, strict=False)
        if ticket.get("status") == "error"
        and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"
    ]
    if gone:
        PushDevice.objects.filter(token__in=gone).delete()
    return len(gone)
