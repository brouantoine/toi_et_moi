from django.conf import settings
from django.db import models

from . import crypto


class CoachConsent(models.Model):
    """The shared AI coach is on only when BOTH partners turned it on."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coach_consent"
    )
    enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"coach consent of {self.user_id}"


class CoachTrial(models.Model):
    """The couple's free month of coach, counted from the first time it opened for both."""

    couple = models.OneToOneField(
        "couples.Couple", on_delete=models.CASCADE, related_name="coach_trial"
    )
    started_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"coach trial of couple {self.couple_id}"


class CoachRole(models.TextChoices):
    PARTNER = "partner"  # written by one of the two partners
    COACH = "coach"  # written by the AI
    NOTICE = "notice"  # the coach could not answer


class CoachMessage(models.Model):
    """One message of the couple's shared thread with the coach. No private side."""

    couple = models.ForeignKey(
        "couples.Couple", on_delete=models.CASCADE, related_name="coach_messages"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="coach_messages",
    )
    role = models.CharField(max_length=8, choices=CoachRole.choices)
    body = models.TextField()  # encrypted, see crypto.py
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        indexes = [models.Index(fields=["couple", "created_at"])]

    def __str__(self) -> str:
        return f"{self.role} #{self.pk}"

    @property
    def text(self) -> str:
        return crypto.decrypt(self.body)

    @text.setter
    def text(self, value: str) -> None:
        self.body = crypto.encrypt(value)
