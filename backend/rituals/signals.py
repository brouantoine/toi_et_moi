"""Live update of the Today screen on both phones (resource name only, no content)."""

from typing import Any

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime import notify_changed

from .models import MoodReply, MorningMood


@receiver(post_save, sender=MorningMood)
@receiver(post_delete, sender=MorningMood)
def mood_changed(sender: type[Any], instance: MorningMood, **kwargs: Any) -> None:
    notify_changed(instance.couple_id, "morning", instance.pk, "upsert")


@receiver(post_save, sender=MoodReply)
def reply_sent(sender: type[Any], instance: MoodReply, **kwargs: Any) -> None:
    couple_id = (
        MorningMood.objects.filter(pk=instance.mood_id).values_list("couple_id", flat=True).first()
    )
    if couple_id:
        notify_changed(couple_id, "morning", instance.mood_id, "upsert")
