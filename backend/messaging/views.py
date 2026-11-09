from typing import Any, cast

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from core.auth import current_user
from core.mixins import CoupleScopedQuerysetMixin
from core.pagination import DefaultCursorPagination
from core.upload_views import ImageUploadTicketSerializer

from . import services
from .models import Message
from .serializers import MediaUploadRequestSerializer, MessageSerializer, SendMessageSerializer


class MessagePagination(DefaultCursorPagination):
    ordering = ("-created_at", "-id")
    page_size = 40


class MessageViewSet(
    CoupleScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet[Message],
):
    """The couple's private thread, newest first. Both read; each deletes their own."""

    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    pagination_class = MessagePagination

    def get_throttles(self) -> list[Any]:
        if self.action in {"create", "upload_url"}:
            self.throttle_scope = "messages"
            return [ScopedRateThrottle()]
        return list(super().get_throttles())

    @extend_schema(request=SendMessageSerializer, responses={201: MessageSerializer})
    def create(self, request: Request) -> Response:
        payload = SendMessageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            message = services.send(self.couple, current_user(request), payload.validated_data)
        except services.MessageRuleError as error:
            raise serializers.ValidationError({"code": error.code}, code=error.code) from error
        return Response(self.get_serializer(message).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance: Message) -> None:
        if instance.author_id != self.request.user.pk:
            raise PermissionDenied("not_author")
        services.delete(instance)

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=["post"], url_path="read")
    def read(self, request: Request) -> Response:
        """The reader opened the conversation: the partner's messages become read."""
        services.mark_read(self.couple, current_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request=MediaUploadRequestSerializer, responses={200: ImageUploadTicketSerializer}
    )
    @action(detail=False, methods=["post"], url_path="upload-url")
    def upload_url(self, request: Request) -> Response:
        """Ticket to upload a photo or a voice note straight to storage."""
        payload = MediaUploadRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            ticket = services.request_upload(
                self.couple, cast(str, payload.validated_data["content_type"])
            )
        except services.MessageRuleError as error:
            raise serializers.ValidationError({"code": error.code}, code=error.code) from error
        return Response(
            {
                "key": ticket.key,
                "url": ticket.url,
                "form_fields": ticket.fields,
                "max_bytes": ticket.max_bytes,
                "expires_in": ticket.expires_in,
            }
        )
