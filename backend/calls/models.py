from django.conf import settings
from django.db import models


class CallKind(models.TextChoices):
    AUDIO = "audio"
    VIDEO = "video"


class CallState(models.TextChoices):
    RINGING = "ringing"  # the partner's phone rings
    ONGOING = "ongoing"  # picked up
    ENDED = "ended"  # hung up after talking
    DECLINED = "declined"  # the partner refused
    MISSED = "missed"  # nobody picked up in time
    CANCELLED = "cancelled"  # the caller hung up before an answer


LIVE_STATES = (CallState.RINGING, CallState.ONGOING)


class Call(models.Model):
    """One voice or video call between the two partners (signalling only, no media)."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="calls")
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calls_made"
    )
    kind = models.CharField(max_length=5, choices=CallKind.choices)
    state = models.CharField(max_length=9, choices=CallState.choices, default=CallState.RINGING)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=["couple", "state"])]

    def __str__(self) -> str:
        return f"{self.kind} call #{self.pk} ({self.state})"
