from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.auth import current_user
from core.permissions import HasActiveCouple, request_couple
from couples.models import Couple

from . import services
from .serializers import (
    CoachConsentInputSerializer,
    CoachPostSerializer,
    CoachThreadSerializer,
)


class CoachView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCouple]

    def couple(self) -> Couple:
        couple = request_couple(self.request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        return couple

    def thread(self) -> Response:
        data = services.thread(self.couple(), current_user(self.request))
        return Response(CoachThreadSerializer(data).data)


class CoachThreadView(CoachView):
    """The couple's shared conversation with the AI coach."""

    @extend_schema(responses={200: CoachThreadSerializer})
    def get(self, request: Request) -> Response:
        return self.thread()

    @extend_schema(responses={204: None})
    def delete(self, request: Request) -> Response:
        """Erases the whole conversation, for both."""
        services.clear(self.couple())
        return Response(status=status.HTTP_204_NO_CONTENT)


class CoachConsentView(CoachView):
    @extend_schema(request=CoachConsentInputSerializer, responses={200: CoachThreadSerializer})
    def put(self, request: Request) -> Response:
        payload = CoachConsentInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.set_consent(
            self.couple(), current_user(request), payload.validated_data["enabled"]
        )
        return self.thread()


class CoachPostView(CoachView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "coach"

    @extend_schema(request=CoachPostSerializer, responses={201: CoachThreadSerializer})
    def post(self, request: Request) -> Response:
        payload = CoachPostSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            services.post(self.couple(), current_user(request), payload.validated_data["text"])
        except services.CoachError as error:
            raise serializers.ValidationError({"code": error.code}, code=error.code) from error
        response = self.thread()
        response.status_code = status.HTTP_201_CREATED
        return response
