from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth import current_user
from core.permissions import HasActiveCouple, request_couple
from couples.models import Couple

from . import services
from .models import Call
from .serializers import (
    CallSerializer,
    CurrentCallSerializer,
    IceServersSerializer,
    StartCallSerializer,
)


class CallsView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCouple]

    def couple(self) -> Couple:
        couple = request_couple(self.request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        return couple

    def respond(self, call: Call, code: int = status.HTTP_200_OK) -> Response:
        data = services.payload(call, current_user(self.request))
        return Response(CallSerializer(data).data, status=code)


def _error(error: services.CallError) -> Exception:
    if error.code == "not_found":
        return NotFound({"code": error.code})
    return serializers.ValidationError({"code": error.code}, code=error.code)


class CurrentCallView(CallsView):
    """The call ringing or going on, if any: the phones check it to show the call screen."""

    @extend_schema(responses={200: CurrentCallSerializer})
    def get(self, request: Request) -> Response:
        call = services.live(self.couple())
        data = {
            "call": services.payload(call, current_user(request)) if call else None,
            "media_ready": services.media_ready(),
        }
        return Response(CurrentCallSerializer(data).data)


class StartCallView(CallsView):
    @extend_schema(request=StartCallSerializer, responses={201: CallSerializer})
    def post(self, request: Request) -> Response:
        payload = StartCallSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            call = services.start(
                self.couple(), current_user(request), payload.validated_data["kind"]
            )
        except services.CallError as error:
            raise _error(error) from error
        return self.respond(call, status.HTTP_201_CREATED)


class CallActionView(CallsView):
    action = ""

    @extend_schema(request=None, responses={200: CallSerializer})
    def post(self, request: Request, call_id: int) -> Response:
        act = {
            "accept": services.accept,
            "decline": services.decline,
            "end": services.hang_up,
        }[self.action]
        try:
            call = act(self.couple(), current_user(request), call_id)
        except services.CallError as error:
            raise _error(error) from error
        return self.respond(call)


class IceServersView(CallsView):
    """Where the phones find each other: STUN, and the TURN relay with fresh credentials."""

    @extend_schema(responses={200: IceServersSerializer})
    def get(self, request: Request) -> Response:
        data = services.ice_servers(current_user(request))
        return Response(IceServersSerializer(data).data)
