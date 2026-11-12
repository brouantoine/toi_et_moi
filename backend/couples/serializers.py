from datetime import date, timedelta

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import User

from .models import Couple, Invitation


def validate_start_date(value: date | None) -> date | None:
    """A couple cannot have started in the future (one day of margin for time zones)."""
    if value is not None and value > timezone.localdate() + timedelta(days=1):
        raise serializers.ValidationError("start_date_in_future")
    return value


class MemberSerializer(serializers.ModelSerializer[User]):
    """What a partner is allowed to see about the other: no email, no birth date."""

    display_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "nickname",
            "display_name",
            "avatar_url",
            "avatar_preset",
            "timezone",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj: User) -> str | None:
        return obj.avatar.url if obj.avatar else None


class InvitationSerializer(serializers.ModelSerializer[Invitation]):
    link = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["code", "expires_at", "link", "share_url"]
        read_only_fields = fields

    def get_link(self, obj: Invitation) -> str:
        return f"{settings.APP_SCHEME}://join/{obj.code}"

    def get_share_url(self, obj: Invitation) -> str:
        """Web page that works whether or not the app is installed (universal/app link)."""
        return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/join/{obj.code}/"


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
            "accent",
            "photo_url",
            "members",
            "invitation",
            "activated_at",
            "plus_until",
        ]
        read_only_fields = ["id", "status", "members", "invitation", "activated_at", "plus_until"]

    def get_photo_url(self, obj: Couple) -> str | None:
        return obj.photo.url if obj.photo else None

    @extend_schema_field(InvitationSerializer(allow_null=True))
    def get_invitation(self, obj: Couple) -> dict[str, str] | None:
        if obj.status != "pending":
            return None
        # An expired code is useless: the app then offers a fresh one instead of showing it.
        invitation = obj.invitations.filter(
            used_at__isnull=True, revoked=False, expires_at__gt=timezone.now()
        ).first()
        return InvitationSerializer(invitation).data if invitation else None

    def validate_start_date(self, value: date | None) -> date | None:
        return validate_start_date(value)

    def validate_currency(self, value: str) -> str:
        value = value.upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("invalid_currency")
        return value


class CreateCoupleSerializer(serializers.Serializer[None]):
    start_date = serializers.DateField(required=False, allow_null=True)
    currency = serializers.CharField(required=False, default="EUR", max_length=3)

    def validate_start_date(self, value: date | None) -> date | None:
        return validate_start_date(value)


class JoinCoupleSerializer(serializers.Serializer[None]):
    code = serializers.CharField(max_length=20)


class CoupleErrorSerializer(serializers.Serializer[None]):
    code = serializers.CharField()
