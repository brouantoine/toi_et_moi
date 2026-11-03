from rest_framework import serializers

from core.storage import signed_url

from .models import Memory, MemoryPhoto
from .services import MAX_TAG_LENGTH, normalize_tags


class MemoryPhotoSerializer(serializers.ModelSerializer[MemoryPhoto]):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MemoryPhoto
        fields = ["id", "url", "thumbnail_url", "width", "height", "position"]
        read_only_fields = fields

    def get_url(self, obj: MemoryPhoto) -> str | None:
        return signed_url(obj.key)

    def get_thumbnail_url(self, obj: MemoryPhoto) -> str | None:
        return signed_url(obj.thumbnail_key or obj.key)


class MemorySerializer(serializers.ModelSerializer[Memory]):
    """A shared memory. Hearts are booleans only: never a counter."""

    tags = serializers.ListField(
        child=serializers.CharField(max_length=MAX_TAG_LENGTH), required=False, max_length=50
    )
    photos = MemoryPhotoSerializer(many=True, read_only=True)
    my_heart = serializers.SerializerMethodField()
    partner_heart = serializers.SerializerMethodField()

    class Meta:
        model = Memory
        fields = [
            "id",
            "title",
            "body",
            "happened_on",
            "place",
            "type",
            "tags",
            "created_by",
            "photos",
            "my_heart",
            "partner_heart",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "photos", "created_at", "updated_at"]

    def _hearts(self, obj: Memory) -> set[int]:
        # Uses the prefetched reactions (no extra query per memory).
        return {r.user_id for r in obj.reactions.all()}

    def _user_id(self) -> int | None:
        request = self.context.get("request")
        return request.user.pk if request else None

    def get_my_heart(self, obj: Memory) -> bool:
        return self._user_id() in self._hearts(obj)

    def get_partner_heart(self, obj: Memory) -> bool:
        me = self._user_id()
        return any(uid != me for uid in self._hearts(obj))

    def validate_tags(self, value: list[str]) -> list[str]:
        return normalize_tags(value)

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("required")
        return value
