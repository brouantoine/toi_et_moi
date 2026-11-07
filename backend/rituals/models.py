from __future__ import annotations

from django.conf import settings
from django.db import models


class Mood(models.TextChoices):
    """The user's own four words, as neutral nouns (no masculine/feminine)."""

    JOYFUL = "joyful", "Grande joie"
    HAPPY = "happy", "Bonne humeur"
    UPSET = "upset", "Contrariété"
    ANGRY = "angry", "Énervement"


class Need(models.TextChoices):
    SPACE = "space", "Espace"
    HUG = "hug", "Câlin"
    HELP = "help", "Aide"
    LISTEN = "listen", "Écoute"
    NOTHING = "nothing", "Rien"


class Reply(models.TextChoices):
    HERE = "here", "Je suis là"
    COURAGE = "courage", "Courage"
    TONIGHT = "tonight", "On en parle ce soir ?"
    THINKING = "thinking", "Je pense à toi"


class MorningMood(models.Model):
    """How one person feels this morning. One per local day, erased after two days."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    couple = models.ForeignKey(
        "couples.Couple", on_delete=models.CASCADE, related_name="morning_moods"
    )
    day = models.DateField()
    mood = models.CharField(max_length=8, choices=Mood.choices)
    need = models.CharField(max_length=8, choices=Need.choices, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "day"], name="one_mood_per_day")]

    def __str__(self) -> str:
        return f"{self.mood} {self.day}"


class MoodReply(models.Model):
    """A one-tap answer to the partner's morning mood."""

    mood = models.ForeignKey(MorningMood, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    reply = models.CharField(max_length=8, choices=Reply.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return self.reply
