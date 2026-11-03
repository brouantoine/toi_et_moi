from typing import Any

import pytest
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from organization.budget import equal_shares
from organization.models import Expense, ExpenseShare, Settlement

pytestmark = pytest.mark.django_db

LIST = "/api/v1/expenses/"
BALANCE = "/api/v1/expenses/balance/"
SETTLE = "/api/v1/expenses/settle/"


def detail(pk: int) -> str:
    return f"/api/v1/expenses/{pk}/"


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def couples():
    couple, alice, bob = make_couple()
    other, carol, _ = make_couple()
    return couple, alice, bob, other, carol


def spend(client: APIClient, **data: Any) -> dict[str, Any]:
    response = client.post(LIST, {"title": "Courses", "amount": 1000, **data}, format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


def test_equal_shares_keep_the_odd_unit_with_the_payer() -> None:
    assert equal_shares(1001) == (501, 500)
    assert equal_shares(1) == (1, 0)


def test_equal_split_paid_by_me(couples) -> None:
    couple, alice, bob, *_ = couples
    body = spend(client_for(alice), amount=1001, spent_on="2026-11-01", category="groceries")
    assert (body["paid_by"], body["my_share"], body["partner_share"]) == ("me", 501, 500)
    assert body["currency"] == couple.currency
    seen = client_for(bob).get(detail(body["id"])).json()
    assert (seen["paid_by"], seen["my_share"], seen["partner_share"]) == ("you", 500, 501)
    assert client_for(bob).get(BALANCE).json() == [
        {"currency": couple.currency, "amount": 500, "direction": "i_owe_partner"}
    ]
    assert client_for(alice).get(BALANCE).json()[0]["direction"] == "partner_owes_me"


def test_paid_by_the_partner_and_custom_split(couples) -> None:
    _, alice, bob, *_ = couples
    body = spend(client_for(alice), amount=3000, paid_by="you", split="custom", my_share=2000)
    assert (body["paid_by"], body["my_share"], body["partner_share"]) == ("you", 2000, 1000)
    # Bob paid, Alice carries 2000: Alice owes Bob 2000.
    assert client_for(alice).get(BALANCE).json()[0] == {
        "currency": "EUR",
        "amount": 2000,
        "direction": "i_owe_partner",
    }
    assert client_for(bob).get(BALANCE).json()[0]["direction"] == "partner_owes_me"


def test_balances_net_out_and_settle_in_one_gesture(couples) -> None:
    _, alice, bob, *_ = couples
    a, b = client_for(alice), client_for(bob)
    spend(a, amount=4000)  # Bob owes 2000
    spend(b, amount=1000)  # Alice owes 500
    assert a.get(BALANCE).json()[0]["amount"] == 1500
    after = b.post(SETTLE, {"currency": "EUR"}, format="json").json()
    assert after == [{"currency": "EUR", "amount": 0, "direction": "settled"}]
    settlement = Settlement.objects.get()
    assert (settlement.from_user, settlement.to_user, settlement.amount) == (bob, alice, 1500)
    # Settling again records nothing.
    a.post(SETTLE, {"currency": "EUR"}, format="json")
    assert Settlement.objects.count() == 1


def test_balance_per_currency(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    spend(a, amount=1000, currency="EUR")
    spend(a, amount=5000, currency="XOF")
    assert [(r["currency"], r["amount"]) for r in a.get(BALANCE).json()] == [
        ("EUR", 500),
        ("XOF", 2500),
    ]


def test_update_recomputes_shares(couples) -> None:
    _, alice, bob, *_ = couples
    body = spend(client_for(alice), amount=1000)
    response = client_for(bob).patch(
        detail(body["id"]), {"split": "custom", "my_share": 1000}, format="json"
    )
    assert response.status_code == 200, response.content
    assert (response.json()["my_share"], response.json()["partner_share"]) == (1000, 0)
    assert client_for(alice).get(BALANCE).json()[0]["amount"] == 1000
    # A new amount on a custom split needs the new share: never guessed.
    url = detail(body["id"])
    assert client_for(alice).patch(url, {"amount": 2000}, format="json").status_code == 400
    response = client_for(alice).patch(url, {"amount": 2000, "my_share": 500}, format="json")
    assert response.status_code == 200, response.content
    assert (response.json()["my_share"], response.json()["partner_share"]) == (500, 1500)
    assert ExpenseShare.objects.filter(expense_id=body["id"]).count() == 2


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "x", "amount": 0},
        {"title": "x", "amount": -5},
        {"title": " ", "amount": 10},
        {"title": "x", "amount": 10, "split": "custom"},
        {"title": "x", "amount": 10, "split": "custom", "my_share": 11},
        {"title": "x", "amount": 10, "currency": "euro"},
        {"title": "x", "amount": 10, "paid_by": "us"},
        {"title": "x", "amount": 10, "category": "luxe"},
    ],
)
def test_validation(couples, payload) -> None:
    _, alice, *_ = couples
    assert client_for(alice).post(LIST, payload, format="json").status_code == 400


def test_strangers_get_404_and_their_balance_is_untouched(couples) -> None:
    _, alice, _, _, carol = couples
    body = spend(client_for(alice))
    c = client_for(carol)
    assert c.get(LIST).json()["results"] == []
    assert c.get(BALANCE).json() == []
    assert c.get(detail(body["id"])).status_code == 404
    assert c.patch(detail(body["id"]), {"amount": 1}, format="json").status_code == 404
    assert c.delete(detail(body["id"])).status_code == 404
    c.post(SETTLE, {"currency": "EUR"}, format="json")
    assert Settlement.objects.count() == 0 and Expense.objects.get().amount == 1000


def test_delete_removes_it_from_the_balance(couples) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    body = spend(a)
    assert a.delete(detail(body["id"])).status_code == 204
    assert a.get(BALANCE).json() == []


def test_query_counts(couples, django_assert_max_num_queries) -> None:
    _, alice, *_ = couples
    a = client_for(alice)
    for i in range(10):
        spend(a, title=f"Dépense {i}")
    with django_assert_max_num_queries(7):
        assert len(a.get(LIST).json()["results"]) == 10
    with django_assert_max_num_queries(10):
        a.get(BALANCE)
