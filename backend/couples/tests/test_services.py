from datetime import date, timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from accounts.tests.factories import UserFactory
from couples import services
from couples.models import CoupleMember, CoupleStatus
from couples.services import CODE_ALPHABET, CoupleError

from .factories import make_couple

pytestmark = pytest.mark.django_db


def test_create_couple_is_pending_with_readable_code() -> None:
    user = UserFactory()
    couple, invitation = services.create_couple(user, start_date=date(2020, 2, 14), currency="cad")
    assert couple.status == CoupleStatus.PENDING
    assert couple.currency == "CAD"
    assert len(invitation.code) == 6
    assert set(invitation.code) <= set(CODE_ALPHABET)
    assert not set(invitation.code) & set("0O1IL")
    delta = invitation.expires_at - timezone.now()
    assert timedelta(hours=47) < delta <= timedelta(hours=48)
    assert services.get_current_couple(user) == couple
    assert services.get_active_couple(user) is None


def test_join_activates_couple() -> None:
    couple, a, b = make_couple()
    assert couple.status == CoupleStatus.ACTIVE
    assert couple.activated_at is not None
    assert services.get_active_couple(a) == couple
    assert services.get_active_couple(b) == couple
    assert couple.partner_of(a) == b
    assert couple.partner_of(b) == a


def test_join_accepts_lowercase_and_separators() -> None:
    a, b = UserFactory(), UserFactory()
    _, invitation = services.create_couple(a)
    messy = f" {invitation.code[:3].lower()}-{invitation.code[3:].lower()} "
    assert services.join_couple(b, messy).status == CoupleStatus.ACTIVE


@pytest.mark.parametrize("code", ["ZZZZZZ", "", "abc"])
def test_join_invalid_code(code: str) -> None:
    with pytest.raises(CoupleError) as exc:
        services.join_couple(UserFactory(), code)
    assert exc.value.code == "invalid_code"


def test_join_expired_code() -> None:
    a = UserFactory()
    _, invitation = services.create_couple(a)
    invitation.expires_at = timezone.now() - timedelta(minutes=1)
    invitation.save()
    with pytest.raises(CoupleError) as exc:
        services.join_couple(UserFactory(), invitation.code)
    assert exc.value.code == "expired_code"


def test_cannot_join_own_couple() -> None:
    a = UserFactory()
    _, invitation = services.create_couple(a)
    with pytest.raises(CoupleError) as exc:
        services.join_couple(a, invitation.code)
    assert exc.value.code == "own_couple"


def test_cannot_create_or_join_when_already_in_couple() -> None:
    _, a, _ = make_couple()
    with pytest.raises(CoupleError) as exc:
        services.create_couple(a)
    assert exc.value.code == "already_in_couple"
    _, invitation = services.create_couple(UserFactory())
    with pytest.raises(CoupleError) as exc:
        services.join_couple(a, invitation.code)
    assert exc.value.code == "already_in_couple"


def test_used_code_cannot_be_reused() -> None:
    a, b = UserFactory(), UserFactory()
    _, invitation = services.create_couple(a)
    services.join_couple(b, invitation.code)
    with pytest.raises(CoupleError) as exc:
        services.join_couple(UserFactory(), invitation.code)
    assert exc.value.code == "invalid_code"


def test_new_invitation_revokes_previous() -> None:
    a = UserFactory()
    couple, first = services.create_couple(a)
    second = services.create_invitation(couple, a)
    assert first.code != second.code
    with pytest.raises(CoupleError) as exc:
        services.join_couple(UserFactory(), first.code)
    assert exc.value.code == "invalid_code"
    assert services.join_couple(UserFactory(), second.code) == couple


def test_cannot_invite_for_active_couple() -> None:
    couple, a, _ = make_couple()
    with pytest.raises(CoupleError) as exc:
        services.create_invitation(couple, a)
    assert exc.value.code == "couple_not_pending"


def test_full_couple_rejects_third_person() -> None:
    couple, _, _ = make_couple()
    couple.status = CoupleStatus.PENDING  # simulate a stale pending state
    couple.save()
    invitation = couple.invitations.first()
    assert invitation is not None
    invitation.used_at = None
    invitation.save()
    with pytest.raises(CoupleError) as exc:
        services.join_couple(UserFactory(), invitation.code)
    assert exc.value.code == "couple_full"


def test_cancel_pending_couple() -> None:
    a = UserFactory()
    services.create_couple(a)
    services.cancel_pending_couple(a)
    assert services.get_current_couple(a) is None
    with pytest.raises(CoupleError):
        services.cancel_pending_couple(a)


def test_db_enforces_one_current_couple_per_user() -> None:
    couple, a, _ = make_couple()
    other, _ = services.create_couple(UserFactory())
    with pytest.raises(IntegrityError):
        CoupleMember.objects.create(couple=other, user=a)
    assert str(couple).startswith("Couple #")
