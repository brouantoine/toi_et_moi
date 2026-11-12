"""Bolingo Plus: who has it, and until when.

Plus is shared: one partner's subscription or gift covers both. The couple's
`plus_until` is a cache of the best of its members' gifts and store subscriptions,
recomputed whenever one of them changes (gift, store event, someone joining).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from accounts.models import User
from core.realtime import notify_changed
from couples.models import Couple, CoupleMember

from .models import PlusGrant, Store, StoreSubscription

logger = logging.getLogger(__name__)

#: RevenueCat events that do not change entitlement dates but are worth logging.
INFORMATIVE = {"TEST", "SUBSCRIBER_ALIAS", "NON_RENEWING_PURCHASE"}


def _best_until(users: list[User]) -> datetime | None:
    grants = PlusGrant.objects.filter(user__in=users).aggregate(m=Max("ends_at"))["m"]
    stores = StoreSubscription.objects.filter(user__in=users).aggregate(m=Max("expires_at"))["m"]
    candidates = [d for d in (grants, stores) if d is not None]
    return max(candidates) if candidates else None


def recompute_couple(couple: Couple) -> None:
    members = list(couple.members.all())
    until = _best_until(members)
    if until != couple.plus_until:
        couple.plus_until = until
        couple.save(update_fields=["plus_until"])
        notify_changed(couple.pk, "couple", couple.pk, "plus")


def recompute_for(user: User) -> None:
    """Every couple this person currently belongs to (normally one)."""
    ids = CoupleMember.objects.filter(user=user, is_current=True).values_list(
        "couple_id", flat=True
    )
    for couple in Couple.objects.filter(pk__in=list(ids)):
        recompute_couple(couple)


@transaction.atomic
def grant(user: User, days: int, reason: str = "", by: User | None = None) -> PlusGrant:
    """Offers `days` of Plus. Stacks after any gift still running, never shortens one."""
    if days <= 0:
        raise ValueError("days must be positive")
    now = timezone.now()
    running = PlusGrant.objects.filter(user=user, ends_at__gt=now).aggregate(m=Max("ends_at"))["m"]
    starts = max(now, running) if running else now
    gift = PlusGrant.objects.create(
        user=user,
        days=days,
        reason=reason[:200],
        granted_by=by,
        starts_at=starts,
        ends_at=starts + timedelta(days=days),
    )
    recompute_for(user)
    return gift


# --- RevenueCat webhook --------------------------------------------------------------


def _store(raw: str | None) -> str:
    return {"APP_STORE": Store.APP_STORE, "PLAY_STORE": Store.PLAY_STORE}.get(
        (raw or "").upper(), Store.OTHER
    )


def _at(ms: Any) -> datetime | None:
    return datetime.fromtimestamp(int(ms) / 1000, tz=UTC) if ms else None


def _user(app_user_id: Any) -> User | None:
    """Our app logs in to RevenueCat with the user's id (see mobile purchases.ts)."""
    try:
        return User.objects.filter(pk=int(str(app_user_id))).first()
    except (TypeError, ValueError):
        return None


@transaction.atomic
def handle_revenuecat(event: dict[str, Any]) -> bool:
    """Applies one RevenueCat event. Returns False when it was ignored."""
    kind = str(event.get("type", ""))
    if kind in INFORMATIVE:
        logger.info("billing: RevenueCat %s", kind)
        return False
    if kind == "TRANSFER":
        for user_id in [*event.get("transferred_from", []), *event.get("transferred_to", [])]:
            user = _user(user_id)
            if user:
                recompute_for(user)
        return True
    user = _user(event.get("app_user_id")) or _user(event.get("original_app_user_id"))
    product = str(event.get("product_id") or "")
    if user is None or not product:
        logger.warning("billing: RevenueCat %s for an unknown user or product", kind)
        return False
    if event.get("environment") == "SANDBOX" and not settings.BILLING_ACCEPT_SANDBOX:
        logger.info("billing: sandbox event ignored in this environment")
        return False
    subscription, _ = StoreSubscription.objects.select_for_update().get_or_create(
        user=user, product_id=product
    )
    event_id = str(event.get("id", ""))
    if event_id and subscription.last_event_id == event_id:
        return False  # RevenueCat retries: the same event twice changes nothing
    subscription.store = _store(event.get("store"))
    subscription.sandbox = event.get("environment") == "SANDBOX"
    expires = _at(event.get("expiration_at_ms"))
    if expires is not None:
        subscription.expires_at = expires
    if kind == "CANCELLATION":
        subscription.will_renew = False  # still Plus until it expires
    elif kind in {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"}:
        subscription.will_renew = True
    elif kind == "EXPIRATION":
        subscription.will_renew = False
        subscription.expires_at = min(expires or timezone.now(), timezone.now())
    subscription.last_event_id = event_id
    subscription.last_event_type = kind
    subscription.save()
    recompute_for(user)
    return True
