"""Couple formation business logic."""

from __future__ import annotations

import secrets
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.models import User

from .models import Couple, CoupleMember, CoupleStatus, Invitation

# No ambiguous characters (0/O, 1/I/L).
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
INVITATION_TTL = timedelta(hours=48)


class CoupleError(Exception):
    """Business rule violation. `code` is stable and translated by the app."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_code(raw: str) -> str:
    return "".join(ch for ch in raw.upper() if ch.isalnum())


def generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def get_current_couple(user: User) -> Couple | None:
    member = (
        CoupleMember.objects.select_related("couple").filter(user=user, is_current=True).first()
    )
    return member.couple if member else None


def get_active_couple(user: User) -> Couple | None:
    couple = get_current_couple(user)
    return couple if couple and couple.status == CoupleStatus.ACTIVE else None


def create_invitation(couple: Couple, by: User) -> Invitation:
    """New code for a pending couple; previous codes are revoked."""
    if couple.status != CoupleStatus.PENDING:
        raise CoupleError("couple_not_pending")
    couple.invitations.filter(used_at__isnull=True, revoked=False).update(revoked=True)
    for _ in range(10):
        try:
            with transaction.atomic():
                return Invitation.objects.create(
                    couple=couple,
                    code=generate_code(),
                    created_by=by,
                    expires_at=timezone.now() + INVITATION_TTL,
                )
        except IntegrityError:  # pragma: no cover - code collision, retry
            continue
    raise CoupleError("code_generation_failed")  # pragma: no cover


@transaction.atomic
def create_couple(
    user: User, *, start_date: date | None = None, currency: str = "EUR"
) -> tuple[Couple, Invitation]:
    if get_current_couple(user) is not None:
        raise CoupleError("already_in_couple")
    couple = Couple.objects.create(start_date=start_date, currency=currency.upper())
    CoupleMember.objects.create(couple=couple, user=user)
    return couple, create_invitation(couple, user)


@transaction.atomic
def join_couple(user: User, raw_code: str) -> Couple:
    code = normalize_code(raw_code)
    invitation = (
        Invitation.objects.select_for_update().select_related("couple").filter(code=code).first()
    )
    if invitation is None or invitation.revoked:
        raise CoupleError("invalid_code")
    if invitation.used_at is not None:
        raise CoupleError("invalid_code")
    if invitation.expires_at <= timezone.now():
        raise CoupleError("expired_code")
    couple = invitation.couple
    if couple.memberships.filter(user=user).exists():
        raise CoupleError("own_couple")
    if get_current_couple(user) is not None:
        raise CoupleError("already_in_couple")
    if couple.status != CoupleStatus.PENDING or couple.memberships.count() >= 2:
        raise CoupleError("couple_full")

    CoupleMember.objects.create(couple=couple, user=user)
    now = timezone.now()
    invitation.used_at = now
    invitation.save(update_fields=["used_at"])
    couple.status = CoupleStatus.ACTIVE
    couple.activated_at = now
    couple.save(update_fields=["status", "activated_at"])
    # Plus is shared: the newcomer's gift or subscription now covers both.
    from billing.services import recompute_couple

    recompute_couple(couple)
    return couple


@transaction.atomic
def cancel_pending_couple(user: User) -> None:
    """Abandon a couple nobody joined yet (e.g. created by mistake)."""
    couple = get_current_couple(user)
    if couple is None or couple.status != CoupleStatus.PENDING:
        raise CoupleError("no_pending_couple")
    couple.delete()
