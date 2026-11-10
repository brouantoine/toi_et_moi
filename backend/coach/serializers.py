from typing import Any

from rest_framework import serializers

Dict = dict[str, Any]


class CoachConsentSerializer(serializers.Serializer[Dict]):
    mine = serializers.BooleanField()
    partner = serializers.BooleanField()


class CoachMessageSerializer(serializers.Serializer[Dict]):
    id = serializers.IntegerField()
    author = serializers.ChoiceField(choices=["me", "you", "coach", "notice"])
    text = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()


class CoachThreadSerializer(serializers.Serializer[Dict]):
    available = serializers.BooleanField(help_text="The server can reach the AI.")
    consent = CoachConsentSerializer()
    active = serializers.BooleanField(help_text="Both partners turned the coach on.")
    thinking = serializers.BooleanField(help_text="The coach is writing its answer.")
    messages = CoachMessageSerializer(many=True)


class CoachConsentInputSerializer(serializers.Serializer[Dict]):
    enabled = serializers.BooleanField()


class CoachPostSerializer(serializers.Serializer[Dict]):
    text = serializers.CharField(max_length=2000)
