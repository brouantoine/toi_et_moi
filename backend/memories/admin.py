from django.contrib import admin

from .models import Memory, MemoryComment, MemoryPhoto


class PhotoInline(admin.TabularInline[MemoryPhoto, Memory]):
    model = MemoryPhoto
    extra = 0
    readonly_fields = ["key", "thumbnail_key", "width", "height"]


@admin.register(Memory)
class MemoryAdmin(admin.ModelAdmin[Memory]):
    """Support use only: metadata, not meant for browsing couples' content."""

    list_display = ["id", "couple", "type", "happened_on", "created_at"]
    list_filter = ["type"]
    raw_id_fields = ["couple", "created_by"]
    inlines = [PhotoInline]


@admin.register(MemoryComment)
class MemoryCommentAdmin(admin.ModelAdmin[MemoryComment]):
    list_display = ["id", "memory", "created_at"]
    raw_id_fields = ["memory", "author"]
