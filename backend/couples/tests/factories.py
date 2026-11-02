from accounts.models import User
from accounts.tests.factories import UserFactory
from couples.models import Couple
from couples.services import create_couple, join_couple


def make_couple(a: User | None = None, b: User | None = None) -> tuple[Couple, User, User]:
    """An active couple of two users (the usual test fixture)."""
    a = a or UserFactory()
    b = b or UserFactory()
    couple, invitation = create_couple(a)
    join_couple(b, invitation.code)
    couple.refresh_from_db()
    return couple, a, b
