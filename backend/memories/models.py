from __future__ import annotations

from django.conf import settings
from django.db import models

MAX_PHOTOS_PER_MEMORY = 10
MAX_TAGS = 10


class MemoryType(models.TextChoices):
    FIRST_TIME = "first_time", "Première fois"
    INSIDE_JOKE = "inside_joke", "Blague à nous"
    PLACE = "place", "Lieu"
    MOMENT = "moment", "Moment"
    QUOTE = "quote", "Citation"


class Memory(models.Model):
    """A shared memory of the couple."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="memories")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True, max_length=5000)
    happened_on = models.DateField()
    place = models.CharField(max_length=200, blank=True)
    type = models.CharField(max_length=12, choices=MemoryType.choices, default=MemoryType.MOMENT)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-happened_on", "-id"]
        indexes = [models.Index(fields=["couple", "-happened_on"])]

    def __str__(self) -> str:
        return self.title


class MemoryPhoto(models.Model):
    memory = models.ForeignKey(Memory, on_delete=models.CASCADE, related_name="photos")
    key = models.CharField(max_length=512, unique=True)
    thumbnail_key = models.CharField(max_length=512, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.key


class MemoryReaction(models.Model):
    """A single, gentle heart. No counter is ever exposed."""

    memory = models.ForeignKey(Memory, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["memory", "user"], name="one_heart_per_person")
        ]

    def __str__(self) -> str:
        return f"heart {self.user_id} -> {self.memory_id}"


class MemoryComment(models.Model):
    memory = models.ForeignKey(Memory, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    body = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return self.body[:40]
