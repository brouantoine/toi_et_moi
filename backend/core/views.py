from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@extend_schema(
    responses=inline_serializer(
        name="Health",
        fields={"status": serializers.CharField(), "brand": serializers.CharField()},
    ),
    auth=[],
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def health(request: Request) -> Response:
    """Liveness probe used by Docker, load balancers and the mobile app."""
    return Response({"status": "ok", "brand": settings.BRAND_NAME})
