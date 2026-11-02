from __future__ import annotations

from datetime import time
from typing import Any, ClassVar

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone as dj_timezone
from django.utils.translation import gettext_lazy as _

from .validators import validate_timezone


class Language(models.TextChoices):
    FR = "fr", "Français"
    EN = "en", "English"


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def _create(self, email: str, password: str | None, **extra: Any) -> User:
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra: Any) -> User:
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra: Any) -> User:
        extra["is_staff"] = True
        extra["is_superuser"] = True
        extra.setdefault("email_verified", True)
        return self._create(email, password, **extra)


def avatar_upload_to(instance: User, filename: str) -> str:
    return f"avatars/{instance.pk}/{filename}"


class User(AbstractBaseUser, PermissionsMixin):
    """A person. Login by email. Nickname is what the partner sees."""

    email = models.EmailField(_("email"), unique=True)
    first_name = models.CharField(_("prénom"), max_length=60)
    nickname = models.CharField(_("surnom"), max_length=60, blank=True)
    avatar = models.FileField(upload_to=avatar_upload_to, blank=True, max_length=512)
    birth_date = models.DateField(null=True, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FR)
    timezone = models.CharField(max_length=64, default="UTC", validators=[validate_timezone])
    quiet_hours_start = models.TimeField(null=True, blank=True, default=time(22, 0))
    quiet_hours_end = models.TimeField(null=True, blank=True, default=time(8, 0))
    email_verified = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=dj_timezone.now)

    objects: ClassVar[UserManager] = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["first_name"]

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    @property
    def display_name(self) -> str:
        """Name shown to the partner: nickname if set, else first name."""
        return self.nickname or self.first_name


class SocialProvider(models.TextChoices):
    APPLE = "apple", "Apple"
    GOOGLE = "google", "Google"


class SocialAccount(models.Model):
    """Link between a user and a verified provider identity (provider + stable subject)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_accounts")
    provider = models.CharField(max_length=10, choices=SocialProvider.choices)
    subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "subject"], name="unique_social_identity")
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.user_id}"
