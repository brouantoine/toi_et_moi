"""Shared pytest fixtures. Factories live in each app's tests/factories.py."""

from collections.abc import Iterator

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.factories import UserFactory


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    """Throttling state lives in the cache: isolate every test."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db: None) -> User:
    return UserFactory()


def auth_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def user_client(user: User) -> APIClient:
    return auth_client(user)
