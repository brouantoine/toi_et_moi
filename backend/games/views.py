from typing import cast

from django.db.models import Model
from django.templatetags.static import static
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth import current_user
from core.mixins import CoupleScopedQuerysetMixin
from core.permissions import HasActiveCouple, request_couple
from core.realtime import notify_changed
from core.upload_views import ImageUploadRequestSerializer, ImageUploadTicketSerializer
from couples.models import Couple

from . import services
from .catalog import KINDS, TOPICS, art_path
from .models import Note
from .serializers import (
    AdultInputSerializer,
    AnswerInputSerializer,
    GamesHomeSerializer,
    ItemSerializer,
    NoteSerializer,
    PackDetailSerializer,
    PackListSerializer,
)


class GamesView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCouple]

    def couple(self) -> Couple:
        couple = request_couple(self.request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        return couple

    def art(self, name: str) -> str:
        """Absolute URL of an illustration served as a static file."""
        return self.request.build_absolute_uri(static(art_path(name)))


def _rule_error(error: services.GameError) -> serializers.ValidationError:
    return serializers.ValidationError({"code": error.code}, code=error.code)


class GamesHomeView(GamesView):
    """Everything the home and the games tab show: today's packs, your turn, progress."""

    @extend_schema(responses={200: GamesHomeSerializer})
    def get(self, request: Request) -> Response:
        data = services.home(self.couple(), current_user(request), self.art)
        return Response(GamesHomeSerializer(data).data)


class PackListView(GamesView):
    @extend_schema(
        parameters=[
            OpenApiParameter("kind", str),
            OpenApiParameter("topic", str),
            OpenApiParameter("state", str, enum=list(services.FILTERS)),
            OpenApiParameter("q", str),
        ],
        responses={200: PackListSerializer},
    )
    def get(self, request: Request) -> Response:
        params = request.query_params
        kind, topic = params.get("kind") or None, params.get("topic") or None
        state = params.get("state") or None
        if (
            (kind and kind not in KINDS)
            or (topic and topic not in TOPICS)
            or (state and state not in services.FILTERS)
        ):
            raise serializers.ValidationError({"code": "unknown_filter"})
        data = services.packs(
            self.couple(),
            current_user(request),
            self.art,
            kind=kind,
            topic=topic,
            state=state,
            query=params.get("q", "")[:60],
        )
        return Response(PackListSerializer(data).data)


class PackDetailView(GamesView):
    @extend_schema(responses={200: PackDetailSerializer})
    def get(self, request: Request, pack_id: str) -> Response:
        try:
            data = services.pack_detail(self.couple(), current_user(request), pack_id, self.art)
        except services.GameError as error:
            raise NotFound({"code": error.code}) from error
        return Response(PackDetailSerializer(data).data)


class AnswerView(GamesView):
    @extend_schema(request=AnswerInputSerializer, responses={201: ItemSerializer})
    def post(self, request: Request) -> Response:
        payload = AnswerInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        try:
            result = services.answer(
                self.couple(),
                current_user(request),
                data["question"],
                self.art,
                choice=data.get("choice"),
                text=data.get("text", ""),
                drawing=data.get("drawing"),
                media_key=data.get("media_key", ""),
                skipped=data.get("skipped", False),
            )
        except services.GameError as error:
            raise _rule_error(error) from error
        return Response(ItemSerializer(result).data, status=status.HTTP_201_CREATED)


class UploadUrlView(GamesView):
    """Ticket to upload a photo answer straight to storage."""

    @extend_schema(
        request=ImageUploadRequestSerializer, responses={200: ImageUploadTicketSerializer}
    )
    def post(self, request: Request) -> Response:
        payload = ImageUploadRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            ticket = services.request_upload(
                self.couple(), cast(str, payload.validated_data["content_type"])
            )
        except services.GameError as error:
            raise _rule_error(error) from error
        return Response(
            {
                "key": ticket.key,
                "url": ticket.url,
                "form_fields": ticket.fields,
                "max_bytes": ticket.max_bytes,
                "expires_in": ticket.expires_in,
            }
        )


class AdultPreferenceView(GamesView):
    """Adults-only packs: each partner turns them on for themselves."""

    @extend_schema(request=AdultInputSerializer, responses={200: GamesHomeSerializer})
    def put(self, request: Request) -> Response:
        payload = AdultInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user = current_user(request)
        services.set_adult(self.couple(), user, payload.validated_data["enabled"])
        return Response(GamesHomeSerializer(services.home(self.couple(), user, self.art)).data)


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
