import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("url", ["/api/schema/", "/api/docs/"])
def test_api_docs_are_hidden_from_the_public(api_client: APIClient, url: str) -> None:
    assert api_client.get(url).status_code in (401, 403)
    api_client.force_authenticate(UserFactory())
    assert api_client.get(url).status_code == 403


def test_staff_can_read_the_schema(api_client: APIClient) -> None:
    api_client.force_authenticate(UserFactory(is_staff=True))
    assert api_client.get("/api/schema/").status_code == 200
