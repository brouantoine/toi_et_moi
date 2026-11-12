"""Calls between the two partners: ring, pick up, decline, hang up.

This is the signalling only. The live voice and video need a native module (WebRTC),
which comes with the installed app; `MEDIA_READY` tells the phones whether it exists.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import messages
from .models import LIVE_STATES, Call, CallKind, CallState

#: An unanswered call stops ringing after this long and becomes "missed".
RING_FOR = timedelta(seconds=45)


class CallError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def media_ready() -> bool:
    return bool(getattr(settings, "CALLS_MEDIA_READY", False))


def _expire(call: Call) -> Call:
    """A call that rang too long without an answer is missed."""
    if call.state == CallState.RINGING and timezone.now() - call.created_at > RING_FOR:
        call.state = CallState.MISSED
        call.ended_at = call.created_at + RING_FOR
        call.save(update_fields=["state", "ended_at"])
        notify_changed(call.couple_id, "calls", call.pk, call.state)
    return call


def payload(call: Call, user: User) -> dict[str, Any]:
    return {
        "id": call.pk,
        "kind": call.kind,
        "state": call.state,
        "direction": "outgoing" if call.caller_id == user.pk else "incoming",
        "created_at": call.created_at,
        "answered_at": call.answered_at,
        "ended_at": call.ended_at,
        "media_ready": media_ready(),
    }


def current(couple: Couple) -> Call | None:
    """The call ringing or going on for this couple, if any."""
    call = Call.objects.filter(couple=couple, state__in=LIVE_STATES).first()
    return _expire(call) if call else None


def live(couple: Couple) -> Call | None:
    call = current(couple)
    return call if call and call.state in LIVE_STATES else None


def _get(couple: Couple, call_id: int) -> Call:
    call = Call.objects.filter(couple=couple, pk=call_id).first()
    if call is None:
        raise CallError("not_found")
    return _expire(call)


def start(couple: Couple, user: User, kind: str) -> Call:
    if kind not in CallKind.values:
        raise CallError("invalid_kind")
    partner = couple.partner_of(user)
    if partner is None:
        raise CallError("no_partner")
    with transaction.atomic():
        existing = live(couple)
        if existing is not None:
            # Already calling each other: join that call instead of ringing twice.
            return existing
        call = Call.objects.create(couple=couple, caller=user, kind=kind)
    notify_changed(couple.pk, "calls", call.pk, call.state)
    _ring(call, user, partner)
    return call


def _ring(call: Call, caller: User, partner: User) -> None:
    """Push to the partner, for when the app is in the background or closed."""
    discreet = preference_for(partner).discreet
    title = "Bolingo" if discreet else caller.display_name
    body = messages.text(partner.language, "discreet" if discreet else call.kind)
    notify(partner, Kind.MESSAGES, title, body, {"screen": "call", "call": call.pk})


def accept(couple: Couple, user: User, call_id: int) -> Call:
    call = _get(couple, call_id)
    if call.caller_id == user.pk:
        raise CallError("not_callee")
    if call.state != CallState.RINGING:
        raise CallError("not_ringing")
    call.state = CallState.ONGOING
    call.answered_at = timezone.now()
    call.save(update_fields=["state", "answered_at"])
    notify_changed(couple.pk, "calls", call.pk, call.state)
    return call


def decline(couple: Couple, user: User, call_id: int) -> Call:
    call = _get(couple, call_id)
    if call.caller_id == user.pk:
        raise CallError("not_callee")
    if call.state != CallState.RINGING:
        raise CallError("not_ringing")
    return _close(call, CallState.DECLINED)


def hang_up(couple: Couple, user: User, call_id: int) -> Call:
    """Either side hangs up: before an answer it is cancelled, after it is ended."""
    call = _get(couple, call_id)
    if call.state == CallState.RINGING:
        if call.caller_id != user.pk:
            return _close(call, CallState.DECLINED)
        return _close(call, CallState.CANCELLED)
    if call.state == CallState.ONGOING:
        return _close(call, CallState.ENDED)
    return call  # already over: hanging up twice is harmless


def _close(call: Call, state: str) -> Call:
    call.state = state
    call.ended_at = timezone.now()
    call.save(update_fields=["state", "ended_at"])
    notify_changed(call.couple_id, "calls", call.pk, call.state)
    return call


def ice_servers(user: User) -> dict[str, Any]:
    """STUN, plus time-limited TURN credentials (coturn "use-auth-secret" REST scheme).

    username = "<expiry timestamp>:<user id>", credential = base64(HMAC-SHA1(secret,
    username)): coturn checks them itself, nothing is stored, and they expire.
    """
    servers: list[dict[str, Any]] = []
    if settings.STUN_URLS:
        servers.append({"urls": list(settings.STUN_URLS)})
    if settings.TURN_URLS and settings.TURN_SECRET:
        expiry = int(timezone.now().timestamp()) + settings.TURN_TTL_SECONDS
        username = f"{expiry}:{user.pk}"
        digest = hmac.new(settings.TURN_SECRET.encode(), username.encode(), hashlib.sha1)
        servers.append(
            {
                "urls": list(settings.TURN_URLS),
                "username": username,
                "credential": base64.b64encode(digest.digest()).decode(),
            }
        )
    return {"ice_servers": servers, "ttl": settings.TURN_TTL_SECONDS}
