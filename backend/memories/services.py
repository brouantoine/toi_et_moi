"""Memories business logic."""

from __future__ import annotations

from django.db import connection, transaction
from django.db.models import Q, QuerySet

from core import storage

from .models import MAX_PHOTOS_PER_MEMORY, MAX_TAGS, Memory, MemoryPhoto
from .tasks import generate_thumbnail

MAX_TAG_LENGTH = 30


def normalize_tags(raw: list[str]) -> list[str]:
    """Trimmed, lowercased, deduplicated (order kept), at most MAX_TAGS."""
    seen: list[str] = []
    for tag in raw:
        clean = " ".join(str(tag).split()).lower()[:MAX_TAG_LENGTH]
        if clean and clean not in seen:
            seen.append(clean)
    return seen[:MAX_TAGS]


def search(queryset: QuerySet[Memory], text: str) -> QuerySet[Memory]:
    """Full-text search on Postgres; simple case-insensitive matching elsewhere (tests)."""
    text = text.strip()
    if not text:
        return queryset
    if connection.vendor == "postgresql":
        from django.contrib.postgres.search import SearchQuery, SearchVector

        vector = SearchVector("title", "body", "place", config="simple")
        query = SearchQuery(text, config="simple", search_type="websearch")
        return queryset.annotate(search=vector).filter(search=query)
    condition = Q()
    for word in text.split():
        condition &= Q(title__icontains=word) | Q(body__icontains=word) | Q(place__icontains=word)
    return queryset.filter(condition)


def filter_by_tag(queryset: QuerySet[Memory], tag: str) -> QuerySet[Memory]:
    wanted = normalize_tags([tag])
    if not wanted:
        return queryset
    if connection.vendor == "postgresql":
        return queryset.filter(tags__contains=wanted)
    # SQLite JSON: match the quoted value inside the serialized list.
    return queryset.filter(tags__icontains=f'"{wanted[0]}"')


class MemoryRuleError(Exception):
    """Business rule violation with a stable code (translated by the app)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def request_photo_upload(memory: Memory, content_type: str) -> storage.UploadTicket:
    if memory.photos.count() >= MAX_PHOTOS_PER_MEMORY:
        raise MemoryRuleError("too_many_photos")
    try:
        return storage.presign_image_upload(
            owner="couples", owner_id=memory.couple_id, kind="memories", content_type=content_type
        )
    except storage.StorageError as exc:
        raise MemoryRuleError(exc.code) from exc


@transaction.atomic
def confirm_photo(
    memory: Memory, key: str, width: int | None = None, height: int | None = None
) -> MemoryPhoto:
    """Records an uploaded photo. The key must be in this couple's space and really exist."""
    if not storage.key_belongs_to(key, owner="couples", owner_id=memory.couple_id, kind="memories"):
        raise MemoryRuleError("invalid_key")
    if MemoryPhoto.objects.filter(key=key).exists():
        raise MemoryRuleError("invalid_key")
    count = Memory.objects.select_for_update().get(pk=memory.pk).photos.count()
    if count >= MAX_PHOTOS_PER_MEMORY:
        raise MemoryRuleError("too_many_photos")
    if storage.uploaded_size(key) is None:
        raise MemoryRuleError("upload_missing")
    photo = MemoryPhoto.objects.create(
        memory=memory, key=key, width=width, height=height, position=count
    )
    transaction.on_commit(lambda: generate_thumbnail.delay(photo.pk))
    return photo
