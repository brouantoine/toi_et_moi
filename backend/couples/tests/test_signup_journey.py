"""The whole first-day journey, through the public API only: two sign-ups, a couple
created with its start date, the partner joining with the code, both seeing the same
active couple."""

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

PASSWORD = "Bolingo-2026!longue"


def sign_up(email: str, first_name: str) -> APIClient:
    client = APIClient()
    response = client.post(
        "/api/v1/auth/register/",
        {
            "email": email,
            "password": PASSWORD,
            "first_name": first_name,
            "is_adult": True,
            "language": "fr",
            "timezone": "Africa/Abidjan",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return client


def test_sign_up_create_with_start_date_then_partner_joins() -> None:
    antoine = sign_up("Antoine@Exemple.test", "Antoine")
    me = antoine.get("/api/v1/me/").json()
    assert (me["email"], me["display_name"], me["timezone"]) == (
        "antoine@exemple.test",
        "Antoine",
        "Africa/Abidjan",
    )
    # Not in a couple yet: the couple-only parts are closed.
    assert antoine.get("/api/v1/games/home/").status_code == 403

    created = antoine.post(
        "/api/v1/couple/", {"start_date": "2024-02-14", "currency": "XOF"}, format="json"
    )
    assert created.status_code == 201, created.content
    couple = created.json()
    assert couple["status"] == "pending" and couple["start_date"] == "2024-02-14"
    code = couple["invitation"]["code"]

    # The same address cannot sign up twice, whatever the case.
    duplicate = APIClient().post(
        "/api/v1/auth/register/",
        {
            "email": "antoine@exemple.TEST",
            "password": PASSWORD,
            "first_name": "Bis",
            "is_adult": True,
        },
        format="json",
    )
    assert duplicate.status_code == 400

    awa = sign_up("awa@exemple.test", "Awa")
    joined = awa.post("/api/v1/couple/join/", {"code": code}, format="json")
    assert joined.status_code == 200, joined.content

    for client in (antoine, awa):
        seen = client.get("/api/v1/couple/").json()
        assert seen["status"] == "active"
        assert seen["start_date"] == "2024-02-14" and seen["currency"] == "XOF"
        assert sorted(m["display_name"] for m in seen["members"]) == ["Antoine", "Awa"]
        assert client.get("/api/v1/games/home/").status_code == 200

    # Either partner can correct the date later (Me > Our couple).
    fixed = awa.patch("/api/v1/couple/", {"start_date": "2024-02-10"}, format="json")
    assert fixed.status_code == 200 and fixed.json()["start_date"] == "2024-02-10"
    assert antoine.get("/api/v1/couple/").json()["start_date"] == "2024-02-10"
    # A start date in the future makes no sense.
    future = awa.patch("/api/v1/couple/", {"start_date": "2999-01-01"}, format="json")
    assert future.status_code == 400

    solo = sign_up("solo@exemple.test", "Solo")
    too_soon = solo.post("/api/v1/couple/", {"start_date": "2999-01-01"}, format="json")
    assert too_soon.status_code == 400

    # The code was single-use.
    third = sign_up("intrus@exemple.test", "Intrus")
    assert third.post("/api/v1/couple/join/", {"code": code}, format="json").status_code == 400
