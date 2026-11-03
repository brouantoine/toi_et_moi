from rest_framework import serializers


class ErrorCodeSerializer(serializers.Serializer[None]):
    """Business error with a stable machine code, translated by the app."""

    code = serializers.CharField()
