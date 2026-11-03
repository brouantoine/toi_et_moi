"""Memories business logic."""

from __future__ import annotations

from django.db import connection
from django.db.models import Q, QuerySet

from .models import MAX_TAGS, Memory

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
