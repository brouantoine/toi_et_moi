from typing import Any

from rest_framework import serializers

from .models import Mood, Need, Reply


class MoodInputSerializer(serializers.Serializer[Any]):
    mood = serializers.ChoiceField(choices=Mood.choices)
    need = serializers.ChoiceField(
        choices=Need.choices, required=False, allow_blank=True, default=""
    )


class MoodSerializer(serializers.Serializer[Any]):
    mood = serializers.ChoiceField(choices=Mood.choices)
    need = serializers.CharField(allow_blank=True)
    replies = serializers.ListField(child=serializers.ChoiceField(choices=Reply.choices))


class MorningTodaySerializer(serializers.Serializer[Any]):
    """Today for me and for the partner (each in their own time zone). Null = not shared."""

    date = serializers.DateField()
    mine = MoodSerializer(allow_null=True)
    partner = MoodSerializer(allow_null=True)


class ReplyInputSerializer(serializers.Serializer[Any]):
    reply = serializers.ChoiceField(choices=Reply.choices)
