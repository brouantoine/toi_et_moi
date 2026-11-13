import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.services import delete_account
from accounts.tests.factories import UserFactory
from couples.models import Couple, CoupleStatus
from couples.services import TEST_PARTNER_DOMAIN, create_couple, get_current_couple

from .factories import make_couple

pytestmark = pytest.mark.django_db

SOLO = reverse("couple-solo-test")


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_solo_test_is_off_by_default() -> None:
    client = client_for(UserFactory())
    assert client.get(SOLO).json() == {"enabled": False}
    assert client.post(SOLO).status_code == 404


def test_solo_test_requires_auth(settings) -> None:
    settings.SOLO_TEST_ENABLED = True
    assert APIClient().post(SOLO).status_code == 401


def test_solo_test_links_a_fictitious_partner(settings) -> None:
    settings.SOLO_TEST_ENABLED = True
    user = UserFactory(language="fr")
    client = client_for(user)
    assert client.get(SOLO).json() == {"enabled": True}
    response = client.post(SOLO)
    assert response.status_code == 201
    assert response.json()["status"] == CoupleStatus.ACTIVE
    couple = get_current_couple(user)
    assert couple is not None
    partner = couple.partner_of(user)
    assert partner is not None and partner.email.endswith("@" + TEST_PARTNER_DOMAIN)
    assert partner.first_name == "Partenaire test"
    assert not partner.has_usable_password()
    # The coach only waits for the tester.
    from coach.services import consented

    assert consented(partner)


def test_solo_test_completes_a_pending_couple(settings) -> None:
    settings.SOLO_TEST_ENABLED = True
    user = UserFactory()
    pending, _ = create_couple(user)
    assert client_for(user).post(SOLO).status_code == 201
    pending.refresh_from_db()
    assert pending.status == CoupleStatus.ACTIVE


def test_solo_test_refuses_an_active_couple(settings) -> None:
    settings.SOLO_TEST_ENABLED = True
    _, member, _ = make_couple()
    response = client_for(member).post(SOLO)
    assert response.status_code == 400
    assert response.json()["code"] == "already_in_couple"


def test_fictitious_partner_leaves_with_the_tester(settings) -> None:
    settings.SOLO_TEST_ENABLED = True
    user = UserFactory()
    client_for(user).post(SOLO)
    delete_account(user)
    assert not User.objects.filter(email__endswith=TEST_PARTNER_DOMAIN).exists()
    assert not Couple.objects.exists()


def test_fictitious_partner_stands_close_so_the_alert_can_be_tested(settings) -> None:
    from notifications.models import Kind
    from places import services as places

    settings.SOLO_TEST_ENABLED = True
    user = UserFactory()
    client_for(user).post(SOLO)
    couple = get_current_couple(user)
    assert couple is not None
    places.accept_terms(user, places.TERMS_VERSION)
    sent = []
    from unittest import mock

    with mock.patch.object(places, "notify", lambda person, kind, *a, **k: sent.append(kind)):
        places.update_position(user, couple, 5.3600, -4.0083)
    view = places.overview(user, couple)
    assert view["partner"]["sharing"] is True
    assert view["km"] is not None and view["km"] <= 1
    assert Kind.PROXIMITY in sent
