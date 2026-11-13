import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_is_public_and_returns_brand() -> None:
    response = APIClient().get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "brand": "Bolingo"}


@pytest.mark.django_db
def test_openapi_schema_is_generated() -> None:
    from accounts.tests.factories import UserFactory

    client = APIClient()
    client.force_authenticate(UserFactory(is_staff=True))
    response = client.get(reverse("schema"))
    assert response.status_code == 200
    assert b"/api/v1/health/" in response.content


def test_env_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    from django.core.exceptions import ImproperlyConfigured

    from config.settings.env import env_bool, env_int, env_list, env_str

    monkeypatch.setenv("X_BOOL", "yes")
    monkeypatch.setenv("X_INT", "7")
    monkeypatch.setenv("X_LIST", "a, b,,c")
    assert env_bool("X_BOOL") is True
    assert env_bool("X_MISSING", default=True) is True
    assert env_int("X_INT", 1) == 7
    assert env_list("X_LIST") == ["a", "b", "c"]
    with pytest.raises(ImproperlyConfigured):
        env_str("X_DEFINITELY_MISSING")
