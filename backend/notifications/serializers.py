from typing import Any

from rest_framework import serializers

from .models import NotificationPreference, Platform


class DeviceSerializer(serializers.Serializer[Any]):
    token = serializers.RegexField(r"^(Exponent|Expo)PushToken\[[^\]]+\]$", max_length=255)
    platform = serializers.ChoiceField(choices=Platform.choices)


class PreferenceSerializer(serializers.ModelSerializer[NotificationPreference]):
    class Meta:
        model = NotificationPreference
        fields = [
            "morning_mood",
            "partner_mood",
            "memory_of_day",
            "daily_question",
            "check_in",
            "thinking_of_you",
            "pause",
            "organization",
            "messages",
            "morning_time",
            "discreet",
        ]
