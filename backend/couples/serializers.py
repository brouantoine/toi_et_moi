from django.conf import settings
from rest_framework import serializers

from accounts.models import User

from .models import Couple, Invitation


class MemberSerializer(serializers.ModelSerializer[User]):
    """What a partner is allowed to see about the other: no email, no birth date."""

    display_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "first_name", "nickname", "display_name", "avatar_url", "timezone"]
        read_only_fields = fields

    def get_avatar_url(self, obj: User) -> str | None:
        return obj.avatar.url if obj.avatar else None


class InvitationSerializer(serializers.ModelSerializer[Invitation]):
    link = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["code", "expires_at", "link"]
        read_only_fields = fields

    def get_link(self, obj: Invitation) -> str:
        return f"{settings.APP_SCHEME}://join/{obj.code}"


class CoupleSerializer(serializers.ModelSerializer[Couple]):
    members = MemberSerializer(many=True, read_only=True)
    invitation = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Couple
        fields = [
            "id",
            "status",
            "start_date",
            "currency",
            "photo_url",
            "members",
            "invitation",
            "activated_at",
        ]
        read_only_fields = ["id", "status", "members", "invitation", "activated_at"]

    def get_photo_url(self, obj: Couple) -> str | None:
        return obj.photo.url if obj.photo else None

    def get_invitation(self, obj: Couple) -> dict[str, str] | None:
        if obj.status != "pending":
            return None
        invitation = obj.invitations.filter(used_at__isnull=True, revoked=False).first()
        return InvitationSerializer(invitation).data if invitation else None

    def validate_currency(self, value: str) -> str:
        value = value.upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("invalid_currency")
        return value


class CreateCoupleSerializer(serializers.Serializer[None]):
    start_date = serializers.DateField(required=False, allow_null=True)
    currency = serializers.CharField(required=False, default="EUR", max_length=3)


class JoinCoupleSerializer(serializers.Serializer[None]):
    code = serializers.CharField(max_length=20)


class CoupleErrorSerializer(serializers.Serializer[None]):
    code = serializers.CharField()
