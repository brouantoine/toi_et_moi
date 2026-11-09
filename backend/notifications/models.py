from __future__ import annotations

from datetime import time

from django.conf import settings
from django.db import models


class Platform(models.TextChoices):
    IOS = "ios", "iOS"
    ANDROID = "android", "Android"


class PushDevice(models.Model):
    """An Expo push token of one of the user's phones."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_devices"
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=8, choices=Platform.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.platform} {self.user_id}"


class Kind(models.TextChoices):
    """Every kind of notification the app may send; each can be turned off."""

    MORNING_MOOD = "morning_mood", "Météo du matin"
    PARTNER_MOOD = "partner_mood", "Météo de l'autre"
    MEMORY_OF_DAY = "memory_of_day", "Souvenir du jour"
    DAILY_QUESTION = "daily_question", "Question du jour"
    CHECK_IN = "check_in", "Check-in"
    THINKING_OF_YOU = "thinking_of_you", "Je pense à toi"
    PAUSE = "pause", "Pause"
    ORGANIZATION = "organization", "Organisation"
    MESSAGES = "messages", "Messages"
    PROXIMITY = "proximity", "Proximité"


class NotificationPreference(models.Model):
    """One row per person: which kinds are on, and the morning settings."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    morning_mood = models.BooleanField(default=True)
    partner_mood = models.BooleanField(default=True)
    memory_of_day = models.BooleanField(default=True)
    daily_question = models.BooleanField(default=True)
    check_in = models.BooleanField(default=True)
    thinking_of_you = models.BooleanField(default=True)
    pause = models.BooleanField(default=True)
    organization = models.BooleanField(default=True)
    messages = models.BooleanField(default=True)
    proximity = models.BooleanField(default=True)
    #: Local time of the morning check-in invitation.
    morning_time = models.TimeField(default=time(8, 0))
    #: Discreet lock screen: say *that* something happened, not *what*.
    discreet = models.BooleanField(default=False)
    #: Local day of the last morning invitation (sent at most once a day).
    last_morning_invite = models.DateField(null=True, blank=True)

    def __str__(self) -> str:
        return f"preferences {self.user_id}"

    def allows(self, kind: str) -> bool:
        return bool(getattr(self, kind, False))
