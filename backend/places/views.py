from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.auth import current_user
from core.permissions import HasActiveCouple, request_couple

from . import services
from .serializers import (
    ConsentInputSerializer,
    ContinuousInputSerializer,
    DistanceSerializer,
    PositionInputSerializer,
)


def _overview(request: Request) -> Response:
    couple = request_couple(request)
    assert couple is not None  # noqa: S101 - HasActiveCouple
    return Response(DistanceSerializer(services.overview(current_user(request), couple)).data)


class DistanceView(APIView):
    """How far apart you are, from your real positions, only if both of you agree."""

    permission_classes = [IsAuthenticated, HasActiveCouple]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    @extend_schema(responses={200: DistanceSerializer})
    def get(self, request: Request) -> Response:
        return _overview(request)

    @extend_schema(request=PositionInputSerializer, responses={200: DistanceSerializer})
    def put(self, request: Request) -> Response:
        """Shares the current position (sent by the app while it is open)."""
        payload = PositionInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        try:
            services.update_position(
                current_user(request),
                couple,
                payload.validated_data["latitude"],
                payload.validated_data["longitude"],
            )
        except services.ConsentRequired as exc:
            raise PermissionDenied("consent_required") from exc
        return _overview(request)

    @extend_schema(responses={204: None})
    def delete(self, request: Request) -> Response:
        """Stops sharing: consent withdrawn and position erased at once."""
        services.stop(current_user(request), request_couple(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class DistanceConsentView(APIView):
    """Accepts the location terms (the version shown in the app)."""

    permission_classes = [IsAuthenticated, HasActiveCouple]

    @extend_schema(request=ConsentInputSerializer, responses={200: DistanceSerializer})
    def post(self, request: Request) -> Response:
        payload = ConsentInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            services.accept_terms(current_user(request), payload.validated_data["terms_version"])
        except services.OutdatedTerms as exc:
            raise ValidationError({"terms_version": "outdated_terms"}) from exc
        return _overview(request)


class DistanceContinuousView(APIView):
    """Turns sharing while the app is closed on or off (separate, explicit opt-in)."""

    permission_classes = [IsAuthenticated, HasActiveCouple]

    @extend_schema(request=ContinuousInputSerializer, responses={200: DistanceSerializer})
    def put(self, request: Request) -> Response:
        payload = ContinuousInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        try:
            services.set_continuous(
                current_user(request), couple, payload.validated_data["enabled"]
            )
        except services.ConsentRequired as exc:
            raise PermissionDenied("consent_required") from exc
        return _overview(request)
