from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Language, User
from .validators import validate_timezone


class UserSerializer(serializers.ModelSerializer[User]):
    """The authenticated user's own profile."""

    display_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "nickname",
            "display_name",
            "avatar_url",
            "avatar_preset",
            "birth_date",
            "language",
            "timezone",
            "quiet_hours_start",
            "quiet_hours_end",
            "email_verified",
        ]
        read_only_fields = ["id", "email", "email_verified"]

    def get_avatar_url(self, obj: User) -> str | None:
        return obj.avatar.url if obj.avatar else None

    def validate_timezone(self, value: str) -> str:
        try:
            validate_timezone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value


class RegisterSerializer(serializers.Serializer[None]):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    first_name = serializers.CharField(max_length=60)
    language = serializers.ChoiceField(choices=Language.choices, default=Language.FR)
    timezone = serializers.CharField(max_length=64, default="UTC")

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(_("Un compte existe déjà avec cet email."))
        return value.lower()

    def validate_timezone(self, value: str) -> str:
        try:
            validate_timezone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        candidate = User(email=attrs["email"], first_name=attrs["first_name"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs


class TokenPairSerializer(serializers.Serializer[None]):
    access = serializers.CharField()
    refresh = serializers.CharField()


class AuthResponseSerializer(TokenPairSerializer):
    user = UserSerializer()


class LogoutSerializer(serializers.Serializer[None]):
    refresh = serializers.CharField()


class TokenSerializer(serializers.Serializer[None]):
    token = serializers.CharField()


class EmailSerializer(serializers.Serializer[None]):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer[None]):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(trim_whitespace=False)


class SocialLoginSerializer(serializers.Serializer[None]):
    id_token = serializers.CharField()
    nonce = serializers.CharField(required=False, allow_null=True, default=None)
    first_name = serializers.CharField(required=False, allow_blank=True, default="", max_length=60)
    language = serializers.ChoiceField(choices=Language.choices, default=Language.FR)


class SocialAuthResponseSerializer(AuthResponseSerializer):
    created = serializers.BooleanField()
