from rest_framework import serializers

from core.storage import signed_url

from .models import Memory, MemoryComment, MemoryPhoto
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


class PhotoUploadRequestSerializer(serializers.Serializer[None]):
    content_type = serializers.CharField()


class PhotoConfirmSerializer(serializers.Serializer[None]):
    key = serializers.CharField(max_length=512)
    width = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    height = serializers.IntegerField(required=False, allow_null=True, min_value=1)


class MemoryCommentSerializer(serializers.ModelSerializer[MemoryComment]):
    author_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()

    class Meta:
        model = MemoryComment
        fields = ["id", "body", "author", "author_name", "mine", "created_at"]
        read_only_fields = ["id", "author", "author_name", "mine", "created_at"]

    def get_author_name(self, obj: MemoryComment) -> str | None:
        return obj.author.display_name if obj.author else None

    def get_mine(self, obj: MemoryComment) -> bool:
        request = self.context.get("request")
        return bool(request and obj.author_id == request.user.pk)

    def validate_body(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("required")
        return value


class HeartSerializer(serializers.Serializer[None]):
    my_heart = serializers.BooleanField()


class OnThisDayItemSerializer(serializers.Serializer[None]):
    years_ago = serializers.IntegerField()
    memory = MemorySerializer()


class OnThisDaySerializer(serializers.Serializer[None]):
    date = serializers.DateField()
    items = OnThisDayItemSerializer(many=True)
