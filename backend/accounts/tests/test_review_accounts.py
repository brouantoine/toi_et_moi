from io import StringIO

import pytest
from django.core.management import call_command

from accounts.models import User
from couples.services import get_current_couple

pytestmark = pytest.mark.django_db


def test_review_accounts_are_a_couple_with_plus_and_can_be_reset() -> None:
    out = StringIO()
    call_command("comptes_revue", "--mot-de-passe", "Revue-2026!longue", stdout=out)
    a = User.objects.get(email="review.a@bolingo.ci")
    b = User.objects.get(email="review.b@bolingo.ci")
    assert a.check_password("Revue-2026!longue") and b.email_verified
    couple = get_current_couple(a)
    assert couple is not None and couple.status == "active" and couple.premium
    assert get_current_couple(b) == couple
    # Running it again only resets the password: still one couple.
    call_command("comptes_revue", "--mot-de-passe", "Autre-2026!longue", stdout=StringIO())
    assert get_current_couple(User.objects.get(email="review.b@bolingo.ci")) == couple
    assert User.objects.get(email="review.a@bolingo.ci").check_password("Autre-2026!longue")
