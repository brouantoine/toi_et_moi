from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth import current_user

from .models import PushDevice
from .serializers import DeviceSerializer, PreferenceSerializer
from .services import preference_for


class DeviceView(APIView):
    """Registers this phone for push (a token always belongs to whoever registers it last)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=DeviceSerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        payload = DeviceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            PushDevice.objects.update_or_create(
                token=payload.validated_data["token"],
                defaults={
                    "user": current_user(request),
                    "platform": payload.validated_data["platform"],
                },
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=DeviceSerializer, responses={204: None})
    def delete(self, request: Request) -> Response:
        """Forgets this phone (sign out). Only one's own tokens can be removed."""
        token = request.data.get("token") if isinstance(request.data, dict) else None
        PushDevice.objects.filter(user=current_user(request), token=token).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PreferenceView(APIView):
    """My notification choices. Never visible to the partner."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PreferenceSerializer})
    def get(self, request: Request) -> Response:
        return Response(PreferenceSerializer(preference_for(current_user(request))).data)

    @extend_schema(request=PreferenceSerializer, responses={200: PreferenceSerializer})
    def patch(self, request: Request) -> Response:
        serializer = PreferenceSerializer(
            preference_for(current_user(request)), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
