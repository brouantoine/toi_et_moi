from __future__ import annotations

from django.conf import settings
from django.db import models


class MessageKind(models.TextChoices):
    TEXT = "text", "Texte"
    PHOTO = "photo", "Photo"
    VOICE = "voice", "Note vocale"


class Message(models.Model):
    """One message of the couple's private thread. No read state is ever stored."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    kind = models.CharField(max_length=5, choices=MessageKind.choices, default=MessageKind.TEXT)
    text = models.TextField(blank=True, max_length=2000)
    media_key = models.CharField(max_length=512, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["couple", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.kind} {self.pk}"
