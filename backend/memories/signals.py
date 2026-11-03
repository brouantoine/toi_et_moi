"""Real deletion of stored files when their database row goes away (after commit)."""

from typing import Any

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.storage import delete_file

from .models import MemoryPhoto


def _delete_keys(keys: list[str]) -> None:
    for key in keys:
        delete_file(key)


@receiver(post_delete, sender=MemoryPhoto)
def delete_photo_files(sender: type[MemoryPhoto], instance: MemoryPhoto, **kwargs: Any) -> None:
    keys = [k for k in (instance.key, instance.thumbnail_key) if k]
    transaction.on_commit(lambda: _delete_keys(keys))
