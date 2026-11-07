from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, Throttled
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth import current_user
from core.permissions import HasActiveCouple, request_couple

from . import services
from .models import MorningMood
from .serializers import (
    MoodInputSerializer,
    MorningTodaySerializer,
    ReplyInputSerializer,
)


def _mood_payload(record: MorningMood | None, replies_from: Any | None) -> dict[str, Any] | None:
    if record is None:
        return None
    replies = record.replies.all()
    if replies_from is not None:
        replies = replies.filter(author=replies_from)
    return {"mood": record.mood, "need": record.need, "replies": [r.reply for r in replies]}


class MorningTodayView(APIView):
    """The morning weather of the couple, today."""

    permission_classes = [IsAuthenticated, HasActiveCouple]

    def _today(self, request: Request) -> dict[str, Any]:
        user = current_user(request)
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        partner = couple.partner_of(user)
        mine = services.mood_of(user)
        theirs = services.mood_of(partner) if partner else None
        return {
            "date": services.today_for(user),
            # On my mood: what the partner answered. On theirs: what I answered.
            "mine": _mood_payload(mine, partner),
            "partner": _mood_payload(theirs, user),
        }

    @extend_schema(responses={200: MorningTodaySerializer})
    def get(self, request: Request) -> Response:
        return Response(MorningTodaySerializer(self._today(request)).data)

    @extend_schema(request=MoodInputSerializer, responses={200: MorningTodaySerializer})
    def put(self, request: Request) -> Response:
        payload = MoodInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        services.share_mood(
            current_user(request),
            couple,
            payload.validated_data["mood"],
            payload.validated_data["need"],
        )
        return Response(MorningTodaySerializer(self._today(request)).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request) -> Response:
        """Takes today's mood back (it is never mandatory)."""
        user = current_user(request)
        MorningMood.objects.filter(user=user, day=services.today_for(user)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MorningReplyView(APIView):
    """A one-tap answer to the partner's mood (3 a day at most, no read receipt)."""

    permission_classes = [IsAuthenticated, HasActiveCouple]

    @extend_schema(request=ReplyInputSerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        payload = ReplyInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        try:
            answer = services.reply_to_partner(
                current_user(request), couple, payload.validated_data["reply"]
            )
        except PermissionError as error:
            raise Throttled(detail="too_many_replies") from error
        if answer is None:
            raise NotFound("no_mood_today")
        return Response(status=status.HTTP_204_NO_CONTENT)
