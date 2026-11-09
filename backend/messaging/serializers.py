from typing import Any

from rest_framework import serializers

from core.auth import current_user
from core.storage import signed_url

from .models import Message, MessageKind


class MessageSerializer(serializers.ModelSerializer[Message]):
    """`author` is `me` / `you` for the reader. No read receipt, by design."""

    author = serializers.SerializerMethodField()
    media_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "kind",
            "text",
            "author",
            "media_url",
            "duration_ms",
            "width",
            "height",
            "created_at",
        ]
        read_only_fields = fields

    def get_author(self, obj: Message) -> str | None:
        if obj.author_id is None:
            return None
        return "me" if obj.author_id == current_user(self.context["request"]).pk else "you"

    def get_media_url(self, obj: Message) -> str | None:
        return signed_url(obj.media_key)


class SendMessageSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=MessageKind.choices, default=MessageKind.TEXT)
    text = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, trim_whitespace=True
    )
    media_key = serializers.CharField(max_length=512, required=False, allow_blank=True)
    duration_ms = serializers.IntegerField(min_value=1, max_value=5 * 60 * 1000, required=False)
    width = serializers.IntegerField(min_value=1, required=False)
    height = serializers.IntegerField(min_value=1, required=False)


class MediaUploadRequestSerializer(serializers.Serializer[Any]):
    content_type = serializers.CharField()
