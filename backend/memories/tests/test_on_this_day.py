from datetime import UTC, date, datetime
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from memories import services

from .factories import MemoryFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/memories/on-this-day/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def at(utc: datetime):
    return patch("memories.services.timezone.now", return_value=utc)


def test_returns_previous_years_with_years_ago() -> None:
    couple, alice, _ = make_couple()
    MemoryFactory(couple=couple, title="Il y a 2 ans", happened_on=date(2024, 6, 21))
    MemoryFactory(couple=couple, title="Il y a 5 ans", happened_on=date(2021, 6, 21))
    MemoryFactory(couple=couple, title="Cette année", happened_on=date(2026, 6, 21))
    MemoryFactory(couple=couple, title="Autre jour", happened_on=date(2024, 6, 20))
    alice.timezone = "Europe/Paris"
    alice.save()
    with at(datetime(2026, 6, 21, 10, 0, tzinfo=UTC)):
        body = client_for(alice).get(URL).json()
    assert body["date"] == "2026-06-21"
    assert [(i["years_ago"], i["memory"]["title"]) for i in body["items"]] == [
        (2, "Il y a 2 ans"),
        (5, "Il y a 5 ans"),
    ]


def test_each_partner_sees_their_own_local_day() -> None:
    couple, alice, bob = make_couple()
    MemoryFactory(couple=couple, title="21 juin", happened_on=date(2020, 6, 21))
    MemoryFactory(couple=couple, title="20 juin", happened_on=date(2020, 6, 20))
    alice.timezone = "Asia/Tokyo"  # already June 21
    alice.save()
    bob.timezone = "America/Los_Angeles"  # still June 20
    bob.save()
    with at(datetime(2026, 6, 20, 22, 0, tzinfo=UTC)):
        tokyo = client_for(alice).get(URL).json()
        la = client_for(bob).get(URL).json()
    assert [i["memory"]["title"] for i in tokyo["items"]] == ["21 juin"]
    assert [i["memory"]["title"] for i in la["items"]] == ["20 juin"]


def test_february_29_memories_show_on_feb_28_of_non_leap_years() -> None:
    couple, _, _ = make_couple()
    MemoryFactory(couple=couple, title="Bissextile", happened_on=date(2024, 2, 29))
    MemoryFactory(couple=couple, title="28 février", happened_on=date(2023, 2, 28))
    titles_2027 = [m.title for m, _ in services.on_this_day(couple.pk, date(2027, 2, 28))]
    assert titles_2027 == ["Bissextile", "28 février"]
    titles_2028 = [m.title for m, _ in services.on_this_day(couple.pk, date(2028, 2, 28))]
    assert titles_2028 == ["28 février"]
    titles_leap = [m.title for m, _ in services.on_this_day(couple.pk, date(2028, 2, 29))]
    assert titles_leap == ["Bissextile"]


def test_unknown_timezone_falls_back_to_utc() -> None:
    with at(datetime(2026, 1, 1, 0, 30, tzinfo=UTC)):
        assert services.local_today("Not/AZone") == date(2026, 1, 1)


def test_stranger_never_sees_another_couple_memories() -> None:
    couple, _, _ = make_couple()
    _, carol, _ = make_couple()
    MemoryFactory(couple=couple, happened_on=date(2020, 6, 21))
    with at(datetime(2026, 6, 21, 12, 0, tzinfo=UTC)):
        assert client_for(carol).get(URL).json()["items"] == []


def test_requires_active_couple() -> None:
    assert APIClient().get(URL).status_code == 401
