import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from accounts.models import User

from .factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db


def test_auth_user_model_is_custom() -> None:
    assert get_user_model() is User


def test_create_user_normalizes_email_and_hashes_password() -> None:
    user = User.objects.create_user("Alice@Example.COM", "s3cret-pass-123", first_name="Alice")
    assert user.email == "alice@example.com"
    assert user.check_password("s3cret-pass-123")
    assert not user.is_staff
    assert not user.email_verified


def test_create_user_without_password_is_unusable() -> None:
    user = User.objects.create_user("social@example.com", first_name="Sam")
    assert not user.has_usable_password()


def test_create_user_requires_email() -> None:
    with pytest.raises(ValueError):
        User.objects.create_user("", "x", first_name="A")


def test_email_is_unique() -> None:
    UserFactory(email="dup@example.com")
    with pytest.raises((IntegrityError, ValidationError)):
        User.objects.create_user("dup@example.com", "pass-12345", first_name="B")


def test_superuser_flags() -> None:
    admin = User.objects.create_superuser("admin@example.com", "pass-12345", first_name="Ad")
    assert admin.is_staff and admin.is_superuser and admin.email_verified


def test_invalid_timezone_rejected() -> None:
    with pytest.raises(ValidationError):
        User.objects.create_user(
            "tz@example.com", "pass-12345", first_name="T", timezone="Mars/Base"
        )


def test_display_name_prefers_nickname() -> None:
    user = UserFactory(first_name="Camille", nickname="")
    assert user.display_name == "Camille"
    user.nickname = "Cam"
    assert user.display_name == "Cam"
    assert str(user) == user.email


def test_factory_password_works() -> None:
    assert UserFactory().check_password(DEFAULT_PASSWORD)


def test_default_quiet_hours() -> None:
    user = UserFactory()
    assert user.quiet_hours_start is not None and user.quiet_hours_start.hour == 22
    assert user.quiet_hours_end is not None and user.quiet_hours_end.hour == 8
