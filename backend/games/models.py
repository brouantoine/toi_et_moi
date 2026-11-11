from django.conf import settings
from django.db import models


class Answer(models.Model):
    """One person's answer to one item of a pack. Final once given.

    Exactly one of ``choice``, ``text``, ``drawing`` or ``media_key`` is filled, depending
    on the kind of the pack, unless the item was skipped.
    """

    couple = models.ForeignKey(
        "couples.Couple", on_delete=models.CASCADE, related_name="game_answers"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_answers"
    )
    question = models.CharField(max_length=80)
    choice = models.PositiveSmallIntegerField(null=True, blank=True)
    text = models.TextField(blank=True, max_length=600)
    #: Finger drawing: [{"c": colour index, "w": width, "p": [x, y, x, y, ...]}], 0..1000.
    drawing = models.JSONField(default=list, blank=True)
    media_key = models.CharField(max_length=512, blank=True)
    skipped = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["couple", "user", "question"], name="one_answer_per_person"
            )
        ]
        indexes = [models.Index(fields=["couple", "question"])]

    def __str__(self) -> str:
        return f"{self.user_id} -> {self.question}"


class GamePreference(models.Model):
    """Adults-only topics stay hidden until BOTH partners turn them on."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_preference"
    )
    adult = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"game preferences of {self.user_id}"


class NoteColor(models.TextChoices):
    RED = "red"
    AMBER = "amber"
    SAGE = "sage"
    LAGOON = "lagoon"
    VIOLET = "violet"


class Note(models.Model):
    """A sticky note both partners see on the home screen."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes"
    )
    text = models.CharField(max_length=280)
    color = models.CharField(max_length=8, choices=NoteColor.choices, default=NoteColor.AMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return self.text[:40]
