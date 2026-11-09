from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from core.realtime import notify_changed

from . import services
from .models import Couple
from .serializers import (
    CoupleErrorSerializer,
    CoupleSerializer,
    CreateCoupleSerializer,
    JoinCoupleSerializer,
)


def _user(request: Request) -> User:
    return request.user  # type: ignore[return-value]


def _error(exc: services.CoupleError) -> Response:
    return Response({"code": exc.code}, status=status.HTTP_400_BAD_REQUEST)


def _couple_response(couple: Couple, code: int = status.HTTP_200_OK) -> Response:
    couple = Couple.objects.prefetch_related("members").get(pk=couple.pk)
    return Response(CoupleSerializer(couple).data, status=code)


class CoupleView(APIView):
    """The requester's current couple (pending or active). Only ever their own."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CoupleSerializer, 404: None})
    def get(self, request: Request) -> Response:
        couple = services.get_current_couple(_user(request))
        if couple is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return _couple_response(couple)

    @extend_schema(
        request=CreateCoupleSerializer,
        responses={201: CoupleSerializer, 400: CoupleErrorSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = CreateCoupleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            couple, _ = services.create_couple(_user(request), **serializer.validated_data)
        except services.CoupleError as exc:
            return _error(exc)
        return _couple_response(couple, status.HTTP_201_CREATED)

    @extend_schema(request=CoupleSerializer, responses={200: CoupleSerializer, 404: None})
    def patch(self, request: Request) -> Response:
        couple = services.get_current_couple(_user(request))
        if couple is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CoupleSerializer(couple, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # The partner's phone refreshes too (colour, start date, currency).
        notify_changed(couple.pk, "couple", couple.pk, "updated")
        return _couple_response(couple)

    @extend_schema(responses={204: None, 400: CoupleErrorSerializer})
    def delete(self, request: Request) -> Response:
        """Cancel a pending couple nobody joined. Leaving an active couple is P9."""
        try:
            services.cancel_pending_couple(_user(request))
        except services.CoupleError as exc:
            return _error(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinCoupleView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "join"

    @extend_schema(
        request=JoinCoupleSerializer,
        responses={200: CoupleSerializer, 400: CoupleErrorSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = JoinCoupleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            couple = services.join_couple(_user(request), serializer.validated_data["code"])
        except services.CoupleError as exc:
            return _error(exc)
        return _couple_response(couple)


class NewInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: CoupleSerializer, 400: CoupleErrorSerializer})
    def post(self, request: Request) -> Response:
        user = _user(request)
        couple = services.get_current_couple(user)
        if couple is None:
            return _error(services.CoupleError("no_pending_couple"))
        try:
            services.create_invitation(couple, user)
        except services.CoupleError as exc:
            return _error(exc)
        return _couple_response(couple)
