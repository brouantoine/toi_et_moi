"""Background jobs for memories (run by Celery; eager in tests)."""

from __future__ import annotations

import io
import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError

from .models import MemoryPhoto

logger = logging.getLogger(__name__)

THUMBNAIL_SIZE = (640, 640)


def thumbnail_key_for(key: str) -> str:
    base = key.rsplit(".", 1)[0]
    return f"{base}_thumb.jpg"


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def generate_thumbnail(photo_id: int) -> None:
    """Creates a small JPEG next to the original and records its size."""
    photo = MemoryPhoto.objects.filter(pk=photo_id).first()
    if photo is None or not default_storage.exists(photo.key):
        return
    try:
        with default_storage.open(photo.key, "rb") as source:
            image = ImageOps.exif_transpose(Image.open(source))
            width, height = image.size
            image = image.convert("RGB")
            image.thumbnail(THUMBNAIL_SIZE)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=80, optimize=True)
    except (UnidentifiedImageError, ValueError):
        # e.g. HEIC without plugin: the original is still served, just no thumbnail.
        logger.info("thumbnail skipped for photo %s (unreadable image)", photo_id)
        return
    key = thumbnail_key_for(photo.key)
    if default_storage.exists(key):
        default_storage.delete(key)
    saved = default_storage.save(key, ContentFile(buffer.getvalue()))
    photo.thumbnail_key = saved
    photo.width = photo.width or width
    photo.height = photo.height or height
    photo.save(update_fields=["thumbnail_key", "width", "height"])
