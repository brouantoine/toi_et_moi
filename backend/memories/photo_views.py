from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.mixins import CoupleScopedQuerysetMixin
from core.serializers import ErrorCodeSerializer

from . import services
from .models import Memory, MemoryPhoto
from .serializers import (
    MemoryPhotoSerializer,
    PhotoConfirmSerializer,
    PhotoUploadRequestSerializer,
    UploadTicketSerializer,
)


class MemoryPhotoViewSet(
    CoupleScopedQuerysetMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet[MemoryPhoto]
):
    """Photos of a memory: 1) ask an upload URL, 2) upload to S3, 3) confirm, (delete)."""

    queryset = MemoryPhoto.objects.select_related("memory")
    serializer_class = MemoryPhotoSerializer
    couple_field = "memory__couple"
    pagination_class = None

    def get_queryset(self) -> QuerySet[Any]:
        return super().get_queryset().filter(memory_id=self.kwargs["memory_pk"])

    def get_memory(self) -> Memory:
        return get_object_or_404(Memory, pk=self.kwargs["memory_pk"], couple=self.couple)

    @extend_schema(
        request=PhotoUploadRequestSerializer,
        responses={200: UploadTicketSerializer, 400: ErrorCodeSerializer},
    )
    @action(detail=False, methods=["post"], url_path="upload-url")
    def upload_url(self, request: Request, memory_pk: str) -> Response:
        memory = self.get_memory()
        serializer = PhotoUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ticket = services.request_photo_upload(
                memory, serializer.validated_data["content_type"]
            )
        except services.MemoryRuleError as exc:
            return Response({"code": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "key": ticket.key,
                "url": ticket.url,
                "form_fields": ticket.fields,
                "max_bytes": ticket.max_bytes,
                "expires_in": ticket.expires_in,
            }
        )

    @extend_schema(
        request=PhotoConfirmSerializer,
        responses={201: MemoryPhotoSerializer, 400: ErrorCodeSerializer},
    )
    def create(self, request: Request, memory_pk: str) -> Response:
        memory = self.get_memory()
        serializer = PhotoConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            photo = services.confirm_photo(
                memory, data["key"], data.get("width"), data.get("height")
            )
        except services.MemoryRuleError as exc:
            return Response({"code": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        photo.refresh_from_db()
        return Response(MemoryPhotoSerializer(photo).data, status=status.HTTP_201_CREATED)
