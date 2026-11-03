from __future__ import annotations

from django.conf import settings
from django.db import models


class EventKind(models.TextChoices):
    EVENT = "event", "Événement"
    BIRTHDAY = "birthday", "Anniversaire"
    REUNION = "reunion", "Retrouvailles"


class Recurrence(models.TextChoices):
    NONE = "none", "Aucune"
    YEARLY = "yearly", "Chaque année"


class Event(models.Model):
    """Shared calendar entry. `date` is the local day; timed events also keep UTC instants."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="events")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=EventKind.choices, default=EventKind.EVENT)
    place = models.CharField(max_length=200, blank=True)
    all_day = models.BooleanField(default=True)
    date = models.DateField()
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    recurrence = models.CharField(max_length=8, choices=Recurrence.choices, default=Recurrence.NONE)
    #: Who the event concerns; null means both of us.
    concerns = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reminder_minutes = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "starts_at", "id"]
        indexes = [models.Index(fields=["couple", "date"])]

    def __str__(self) -> str:
        return self.title
