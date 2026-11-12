from typing import Any

from rest_framework import serializers

from .models import CallKind, CallState

Dict = dict[str, Any]


class CallSerializer(serializers.Serializer[Dict]):
    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=CallKind.choices)
    state = serializers.ChoiceField(choices=CallState.choices)
    direction = serializers.ChoiceField(choices=["outgoing", "incoming"])
    created_at = serializers.DateTimeField()
    answered_at = serializers.DateTimeField(allow_null=True)
    ended_at = serializers.DateTimeField(allow_null=True)
    media_ready = serializers.BooleanField(
        help_text="Live voice and video exist in this build (installed app, not Expo Go)."
    )


class CurrentCallSerializer(serializers.Serializer[Dict]):
    call = CallSerializer(allow_null=True)
    media_ready = serializers.BooleanField(
        help_text="Live voice/video exist on the server side; the app hides calls otherwise."
    )


class StartCallSerializer(serializers.Serializer[Dict]):
    kind = serializers.ChoiceField(choices=CallKind.choices)
