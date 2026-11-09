"""Live thread on both phones: only 'something changed', never the content."""

from typing import Any

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime import notify_changed

from .models import Message


@receiver(post_save, sender=Message)
@receiver(post_delete, sender=Message)
def message_changed(sender: type[Any], instance: Message, **kwargs: Any) -> None:
    action = "delete" if kwargs.get("signal") is post_delete else "upsert"
    notify_changed(instance.couple_id, "messages", instance.pk, action)
