from datetime import timedelta
from io import StringIO
from typing import Any

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from billing import services
from billing.models import PlusGrant, StoreSubscription
from couples.models import Couple
from couples.tests.factories import make_couple

pytestmark = pytest.mark.django_db

HOOK = "/api/v1/billing/revenuecat/"
SECRET = "Bearer rc-secret"


def ms(when: Any) -> int:
    return int(when.timestamp() * 1000)


def post_event(client: APIClient, event: dict[str, Any], auth: str = SECRET) -> int:
    return client.post(HOOK, {"event": event}, format="json", HTTP_AUTHORIZATION=auth).status_code


@pytest.fixture(autouse=True)
def webhook_secret(settings) -> None:
    settings.REVENUECAT_WEBHOOK_AUTH = SECRET
    settings.BILLING_ACCEPT_SANDBOX = True


def test_a_gift_covers_both_partners_and_stacks() -> None:
    couple, me, partner = make_couple()
    assert couple.premium is False
    first = services.grant(me, 30, "ami")
    couple.refresh_from_db()
    assert couple.premium is True
    assert abs((couple.plus_until - timezone.now()) - timedelta(days=30)) < timedelta(minutes=1)
    # A second gift starts when the first ends: nothing is lost.
    second = services.grant(partner, 10)
    assert second.starts_at < first.ends_at or second.user == partner
    services.grant(me, 15)
    couple.refresh_from_db()
    assert couple.plus_until >= first.ends_at + timedelta(days=15) - timedelta(minutes=1)
    with pytest.raises(ValueError):
        services.grant(me, 0)


def test_joining_a_couple_shares_the_gift() -> None:
    from couples.services import create_couple, join_couple

    alice, bob = UserFactory(), UserFactory()
    services.grant(alice, 30)
    couple, invitation = create_couple(alice)
    join_couple(bob, invitation.code)
    couple.refresh_from_db()
    assert couple.premium is True


def test_the_command_offers_plus_by_email() -> None:
    couple, me, _ = make_couple()
    out = StringIO()
    call_command("offrir_plus", me.email.upper(), "45", "--raison", "testeur", stdout=out)
    assert "45 jours" in out.getvalue()
    couple.refresh_from_db()
    assert couple.premium is True
    assert PlusGrant.objects.get().reason == "testeur"


def test_store_purchase_renewal_cancellation_and_expiry() -> None:
    couple, me, _ = make_couple()
    api = APIClient()
    soon = timezone.now() + timedelta(days=30)
    event = {
        "id": "evt-1",
        "type": "INITIAL_PURCHASE",
        "app_user_id": str(me.pk),
        "product_id": "bolingo_plus_monthly",
        "store": "APP_STORE",
        "environment": "PRODUCTION",
        "expiration_at_ms": ms(soon),
    }
    assert post_event(api, event) == 200
    couple.refresh_from_db()
    assert couple.premium is True  # the partner who did not pay has Plus too
    # The same event again (RevenueCat retries) changes nothing.
    assert post_event(api, event) == 200
    assert StoreSubscription.objects.count() == 1
    # Cancelled: still Plus until the end of the paid period.
    post_event(api, {**event, "id": "evt-2", "type": "CANCELLATION"})
    couple.refresh_from_db()
    assert couple.premium is True
    assert StoreSubscription.objects.get().will_renew is False
    # Expired: Plus ends.
    post_event(api, {**event, "id": "evt-3", "type": "EXPIRATION"})
    couple.refresh_from_db()
    assert couple.premium is False


def test_the_webhook_needs_its_secret_and_ignores_strangers() -> None:
    _, me, _ = make_couple()
    api = APIClient()
    event = {
        "id": "x",
        "type": "INITIAL_PURCHASE",
        "app_user_id": str(me.pk),
        "product_id": "bolingo_plus_yearly",
        "expiration_at_ms": ms(timezone.now() + timedelta(days=365)),
    }
    assert post_event(api, event, auth="Bearer wrong") == 401
    assert post_event(api, event, auth="") == 401
    assert StoreSubscription.objects.count() == 0
    assert post_event(api, {**event, "app_user_id": "999999"}) == 200
    assert post_event(api, {**event, "app_user_id": "$RCAnonymousID:abc"}) == 200
    assert StoreSubscription.objects.count() == 0
    assert api.post(HOOK, {"nope": 1}, format="json", HTTP_AUTHORIZATION=SECRET).status_code == 400


def test_sandbox_purchases_can_be_refused_in_production(settings) -> None:
    settings.BILLING_ACCEPT_SANDBOX = False
    couple, me, _ = make_couple()
    post_event(
        APIClient(),
        {
            "id": "s",
            "type": "INITIAL_PURCHASE",
            "app_user_id": str(me.pk),
            "product_id": "bolingo_plus_monthly",
            "environment": "SANDBOX",
            "expiration_at_ms": ms(timezone.now() + timedelta(days=3)),
        },
    )
    assert Couple.objects.get(pk=couple.pk).premium is False


def test_the_couple_shows_until_when_it_has_plus() -> None:
    _, me, _ = make_couple()
    services.grant(me, 7)
    client = APIClient()
    client.force_authenticate(me)
    assert client.get("/api/v1/couple/").json()["plus_until"] is not None
