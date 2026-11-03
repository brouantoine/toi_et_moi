import datetime as dt
from typing import Any

import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from organization.models import Chore
from organization.services import add_period, next_due, week_bounds

pytestmark = pytest.mark.django_db

LIST = "/api/v1/chores/"
WEEK = "/api/v1/chores/week/"
TODAY = dt.date(2026, 11, 4)  # a Wednesday


def detail(pk: int, action: str = "") -> str:
    return f"/api/v1/chores/{pk}/{action + '/' if action else ''}"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture(autouse=True)
def frozen_today(monkeypatch) -> None:
    monkeypatch.setattr("organization.chore_views.local_today", lambda _tz: TODAY)


@pytest.fixture
def couples():
    couple, alice, bob = make_couple()
    other, carol, _ = make_couple()
    return couple, alice, bob, other, carol


def create(client: APIClient, **data: object) -> dict[str, Any]:
    response = client.post(LIST, {"title": "Vaisselle", **data}, format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


@pytest.mark.parametrize(
    ("day", "recurrence", "expected"),
    [
        (dt.date(2026, 1, 31), "daily", dt.date(2026, 2, 1)),
        (dt.date(2026, 1, 31), "weekly", dt.date(2026, 2, 7)),
        (dt.date(2026, 1, 31), "monthly", dt.date(2026, 2, 28)),
        (dt.date(2026, 12, 15), "monthly", dt.date(2027, 1, 15)),
    ],
)
def test_add_period(day, recurrence, expected) -> None:
    assert add_period(day, recurrence) == expected


def test_next_due_skips_missed_periods_without_guilt() -> None:
    # Overdue by weeks: the next date is simply the first one after today.
    assert next_due(dt.date(2026, 10, 1), "weekly", TODAY) == dt.date(2026, 11, 5)
    assert next_due(None, "daily", TODAY) == dt.date(2026, 11, 5)


def test_week_bounds_monday_to_sunday() -> None:
    assert week_bounds(TODAY) == (dt.date(2026, 11, 2), dt.date(2026, 11, 8))


def test_assignee_is_relative_and_defaults_to_us(couples) -> None:
    _, alice, bob, *_ = couples
    a, b = client_for(alice), client_for(bob)
    assert create(a)["assignee"] == "us"
    mine = create(a, title="Poubelles", assignee="me")
    assert b.get(detail(mine["id"])).json()["assignee"] == "you"
    theirs = create(a, title="Linge", assignee="you")
    assert b.get(detail(theirs["id"])).json()["assignee"] == "me"


def test_complete_one_off_then_reopen(couples) -> None:
    _, alice, bob, *_ = couples
    chore = create(client_for(alice), due_date="2026-11-05")
    done = client_for(bob).post(detail(chore["id"], "complete")).json()
    assert done["done_at"] and done["last_done_at"]
    assert client_for(alice).get(LIST).json() == []
    assert [c["id"] for c in client_for(alice).get(LIST, {"done": "true"}).json()] == [chore["id"]]
    reopened = client_for(alice).post(detail(chore["id"], "reopen")).json()
    assert reopened["done_at"] is None


def test_complete_recurring_moves_to_next_due_date(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    chore = create(a, recurrence="weekly", due_date="2026-11-03")
    done = a.post(detail(chore["id"], "complete")).json()
    assert (done["due_date"], done["done_at"]) == ("2026-11-10", None)
    assert done["last_done_at"]


def test_week_groups_by_who_carries_without_any_count(couples) -> None:
    _, alice, bob, *_ = couples
    a = client_for(alice)
    mine = create(a, title="Poubelles", assignee="me", due_date="2026-11-06")
    yours = create(a, title="Linge", assignee="you", due_date="2026-11-02")
    ours = create(a, title="Courses", recurrence="weekly")
    create(a, title="Plus tard", due_date="2026-11-20")
    done = create(a, title="Déjà fait", due_date="2026-11-04")
    a.post(detail(done["id"], "complete"))

    week = a.get(WEEK).json()
    assert (week["start"], week["end"]) == ("2026-11-02", "2026-11-08")
    assert [c["id"] for c in week["me"]] == [mine["id"]]
    assert [c["id"] for c in week["you"]] == [yours["id"]]
    assert [c["id"] for c in week["us"]] == [ours["id"]]
    assert set(week) == {"start", "end", "me", "you", "us"}  # no totals, no score

    seen_by_bob = client_for(bob).get(WEEK).json()
    assert [c["id"] for c in seen_by_bob["me"]] == [yours["id"]]
    assert [c["id"] for c in seen_by_bob["you"]] == [mine["id"]]


def test_validation(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    assert a.post(LIST, {"title": " "}, format="json").status_code == 400
    assert a.post(LIST, {"title": "x", "recurrence": "yearly"}, format="json").status_code == 400
    assert a.post(LIST, {"title": "x", "assignee": "them"}, format="json").status_code == 400


def test_strangers_get_404(couples) -> None:
    _, alice, _, _, carol = couples
    chore = create(client_for(alice))
    c = client_for(carol)
    assert c.get(LIST).json() == []
    assert c.get(WEEK).json()["us"] == []
    for method, url in [
        ("get", detail(chore["id"])),
        ("patch", detail(chore["id"])),
        ("delete", detail(chore["id"])),
        ("post", detail(chore["id"], "complete")),
        ("post", detail(chore["id"], "reopen")),
    ]:
        assert getattr(c, method)(url).status_code == 404
    assert Chore.objects.get().done_at is None


def test_query_counts(couples, django_assert_max_num_queries) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    for i in range(8):
        create(a, title=f"Tâche {i}", assignee="you", due_date="2026-11-05")
    with django_assert_max_num_queries(6):
        assert len(a.get(LIST).json()) == 8
    with django_assert_max_num_queries(6):
        assert len(a.get(WEEK).json()["you"]) == 8
