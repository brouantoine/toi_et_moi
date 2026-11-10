from django.db.models import Model
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth import current_user
from core.mixins import CoupleScopedQuerysetMixin
from core.permissions import HasActiveCouple, request_couple
from core.realtime import notify_changed
from couples.models import Couple

from . import services
from .catalog import KINDS, TOPICS
from .models import Note
from .serializers import (
    AdultInputSerializer,
    AnswerInputSerializer,
    GamesHomeSerializer,
    NoteSerializer,
    QuestionSerializer,
)


class GamesView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCouple]

    def couple(self) -> Couple:
        couple = request_couple(self.request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        return couple


class GamesHomeView(GamesView):
    """Everything the home and the games tab show: today's pair, your turn, progress."""

    @extend_schema(responses={200: GamesHomeSerializer})
    def get(self, request: Request) -> Response:
        data = services.home(self.couple(), current_user(request))
        return Response(GamesHomeSerializer(data).data)


class QuestionListView(GamesView):
    @extend_schema(
        parameters=[OpenApiParameter("topic", str), OpenApiParameter("kind", str)],
        responses={200: QuestionSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        topic = request.query_params.get("topic") or None
        kind = request.query_params.get("kind") or None
        if (topic and topic not in TOPICS) or (kind and kind not in KINDS):
            raise serializers.ValidationError({"code": "unknown_filter"})
        data = services.questions(self.couple(), current_user(request), topic, kind)
        return Response(data)


class AnswerView(GamesView):
    @extend_schema(request=AnswerInputSerializer, responses={201: QuestionSerializer})
    def post(self, request: Request) -> Response:
        payload = AnswerInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        try:
            result = services.answer(
                self.couple(),
                current_user(request),
                data["question"],
                data.get("choice"),
                data.get("text", ""),
            )
        except services.GameError as error:
            raise serializers.ValidationError({"code": error.code}, code=error.code) from error
        return Response(QuestionSerializer(result).data, status=status.HTTP_201_CREATED)


class AdultPreferenceView(GamesView):
    """Adults-only topics: each partner turns them on for themselves."""

    @extend_schema(request=AdultInputSerializer, responses={200: GamesHomeSerializer})
    def put(self, request: Request) -> Response:
        payload = AdultInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user = current_user(request)
        services.set_adult(self.couple(), user, payload.validated_data["enabled"])
        return Response(GamesHomeSerializer(services.home(self.couple(), user)).data)


class NoteViewSet(
    CoupleScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet[Note],
):
    """Sticky notes of the couple. Both read and add; each removes their own."""

    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    author_field = "author"
    pagination_class = None

    def perform_create(self, serializer: serializers.BaseSerializer[Model]) -> None:
        super().perform_create(serializer)
        notify_changed(self.couple.pk, "notes", 0, "upsert")

    def perform_destroy(self, instance: Note) -> None:
        if instance.author_id != self.request.user.pk:
            raise PermissionDenied("not_author")
        instance.delete()
        notify_changed(self.couple.pk, "notes", 0, "delete")
