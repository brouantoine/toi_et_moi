import datetime as dt

import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from organization.models import Event, Recurrence
from organization.services import same_day_in_year

from .factories import EventFactory

pytestmark = pytest.mark.django_db

LIST = "/api/v1/events/"
OCC = "/api/v1/events/occurrences/"


def detail(pk: int) -> str:
    return f"/api/v1/events/{pk}/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couples():
    couple, alice, bob = make_couple()
    other, carol, _ = make_couple()
    return couple, alice, bob, other, carol


def test_create_all_day_event_bound_to_couple(couples) -> None:
    couple, alice, *_ = couples
    response = client_for(alice).post(
        LIST,
        {"title": " Dîner chez tes parents ", "date": "2026-05-10", "place": "Lyon"},
        format="json",
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert body["title"] == "Dîner chez tes parents"
    assert (body["all_day"], body["starts_at"], body["concerns"]) == (True, None, "us")
    event = Event.objects.get()
    assert (event.couple, event.created_by) == (couple, alice)


def test_concerns_is_relative_to_the_reader(couples) -> None:
    _, alice, bob, *_ = couples
    alice.timezone = bob.timezone = "Europe/Paris"
    created = (
        client_for(alice)
        .post(LIST, {"title": "Dentiste", "date": "2026-05-10", "concerns": "you"}, format="json")
        .json()
    )
    assert created["concerns"] == "you"
    assert Event.objects.get().concerns == bob
    assert client_for(bob).get(detail(created["id"])).json()["concerns"] == "me"
    mine = client_for(bob).post(
        LIST, {"title": "Sport", "date": "2026-05-11", "concerns": "me"}, format="json"
    )
    assert client_for(alice).get(detail(mine.json()["id"])).json()["concerns"] == "you"


def test_timed_event_takes_the_local_day_of_its_author(couples) -> None:
    _, alice, *_ = couples
    alice.timezone = "America/Montreal"
    alice.save()
    response = client_for(alice).post(
        LIST,
        {
            "title": "Cinéma",
            "all_day": False,
            "starts_at": "2026-05-11T01:30:00Z",
            "ends_at": "2026-05-11T03:30:00Z",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    assert response.json()["date"] == "2026-05-10"  # 21:30 in Montreal


@pytest.mark.parametrize(
    "payload",
    [
        {"title": " ", "date": "2026-05-10"},
        {"title": "Sans date"},
        {"title": "Sans heure", "all_day": False},
        {
            "title": "À l'envers",
            "all_day": False,
            "starts_at": "2026-05-10T20:00:00Z",
            "ends_at": "2026-05-10T18:00:00Z",
        },
        {"title": "Rappel trop tôt", "date": "2026-05-10", "reminder_minutes": 100000},
        {"title": "Pour qui ?", "date": "2026-05-10", "concerns": "them"},
    ],
)
def test_validation(couples, payload) -> None:
    _, alice, *_ = couples
    assert client_for(alice).post(LIST, payload, format="json").status_code == 400


def test_switching_to_all_day_clears_times(couples) -> None:
    couple, alice, *_ = couples
    event = EventFactory(
        couple=couple,
        all_day=False,
        starts_at=dt.datetime(2026, 5, 10, 18, tzinfo=dt.UTC),
        ends_at=dt.datetime(2026, 5, 10, 19, tzinfo=dt.UTC),
    )
    response = client_for(alice).patch(detail(event.pk), {"all_day": True}, format="json")
    assert response.status_code == 200, response.content
    event.refresh_from_db()
    assert (event.starts_at, event.ends_at, event.date) == (None, None, dt.date(2026, 5, 10))


def test_partner_shares_the_calendar_and_strangers_get_404(couples) -> None:
    couple, alice, bob, other, carol = couples
    event = EventFactory(couple=couple, created_by=alice)
    EventFactory(couple=other, created_by=carol)
    assert [e["id"] for e in client_for(bob).get(LIST).json()] == [event.pk]
    assert (
        client_for(bob).patch(detail(event.pk), {"title": "Modifié"}, format="json").status_code
        == 200
    )
    stranger = client_for(carol)
    assert stranger.get(detail(event.pk)).status_code == 404
    assert stranger.patch(detail(event.pk), {"title": "x"}).status_code == 404
    assert stranger.delete(detail(event.pk)).status_code == 404
    assert client_for(bob).delete(detail(event.pk)).status_code == 204


def test_anonymous_is_refused() -> None:
    assert APIClient().get(LIST).status_code == 401


def test_same_day_in_year_handles_29_february() -> None:
    assert same_day_in_year(dt.date(2024, 2, 29), 2026) == dt.date(2026, 2, 28)
    assert same_day_in_year(dt.date(2024, 2, 29), 2028) == dt.date(2028, 2, 29)


def test_occurrences_expand_yearly_events_within_the_range(couples) -> None:
    couple, alice, *_ = couples
    once = EventFactory(couple=couple, title="Concert", date=dt.date(2026, 3, 1))
    EventFactory(couple=couple, title="Hors période", date=dt.date(2026, 9, 1))
    birthday = EventFactory(
        couple=couple,
        title="Anniversaire de Sam",
        kind="birthday",
        date=dt.date(1992, 2, 29),
        recurrence=Recurrence.YEARLY,
    )
    EventFactory(
        couple=couple,
        title="Pas encore né",
        date=dt.date(2027, 1, 1),
        recurrence=Recurrence.YEARLY,
    )
    response = client_for(alice).get(OCC, {"start": "2026-01-01", "end": "2026-06-30"})
    assert response.status_code == 200, response.content
    got = [(o["date"], o["event"]["id"]) for o in response.json()]
    assert got == [("2026-02-28", birthday.pk), ("2026-03-01", once.pk)]


def test_yearly_timed_event_keeps_its_hour(couples) -> None:
    couple, alice, *_ = couples
    EventFactory(
        couple=couple,
        all_day=False,
        date=dt.date(2025, 6, 21),
        starts_at=dt.datetime(2025, 6, 21, 19, tzinfo=dt.UTC),
        recurrence=Recurrence.YEARLY,
    )
    data = client_for(alice).get(OCC, {"start": "2026-06-01", "end": "2026-06-30"}).json()
    assert [(o["date"], o["starts_at"]) for o in data] == [("2026-06-21", "2026-06-21T19:00:00Z")]


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"start": "2026-01-01"},
        {"start": "2026-02-01", "end": "2026-01-01"},
        {"start": "2026-01-01", "end": "2027-03-01"},
        {"start": "hier", "end": "demain"},
    ],
)
def test_occurrences_need_a_valid_range(couples, params) -> None:
    _, alice, *_ = couples
    assert client_for(alice).get(OCC, params).status_code == 400


def test_occurrences_are_scoped_to_the_couple(couples, django_assert_max_num_queries) -> None:
    couple, alice, bob, other, carol = couples
    for i in range(5):
        EventFactory(couple=couple, concerns=bob, date=dt.date(2026, 5, i + 1))
    EventFactory(couple=other, date=dt.date(2026, 5, 2))
    with django_assert_max_num_queries(6):
        data = client_for(alice).get(OCC, {"start": "2026-05-01", "end": "2026-05-31"}).json()
    assert len(data) == 5 and {o["event"]["concerns"] for o in data} == {"you"}
    assert client_for(carol).get(OCC, {"start": "2026-05-01", "end": "2026-05-31"}).json() != data
