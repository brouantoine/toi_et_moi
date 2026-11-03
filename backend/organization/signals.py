"""Broadcasts organization changes to the couple's phones (resource names only)."""

from typing import Any

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime import notify_changed

from .models import Chore, Event, Expense, ListItem, Settlement, SharedList

RESOURCES: dict[type[Any], str] = {
    Event: "events",
    SharedList: "lists",
    Chore: "chores",
    Expense: "expenses",
    Settlement: "expenses",
}


@receiver(post_save)
@receiver(post_delete)
def broadcast(sender: type[Any], instance: Any, **kwargs: Any) -> None:
    action = "delete" if kwargs.get("signal") is post_delete else "upsert"
    if sender is ListItem:
        couple_id = (
            SharedList.objects.filter(pk=instance.list_id)
            .values_list("couple_id", flat=True)
            .first()
        )
        if couple_id:  # gone with its list: the list deletion is broadcast instead
            notify_changed(couple_id, "list_items", instance.pk, action, list_id=instance.list_id)
    elif sender in RESOURCES and instance.couple_id:
        notify_changed(instance.couple_id, RESOURCES[sender], instance.pk, action)
