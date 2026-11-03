"""Reusable endpoints for a single image field: upload URL, set (confirm), remove."""

from __future__ import annotations

from django.db import models
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ErrorCodeSerializer
from .uploads import UploadRuleError, request_upload, set_image


class ImageUploadRequestSerializer(serializers.Serializer[None]):
    content_type = serializers.CharField()


class ImageUploadTicketSerializer(serializers.Serializer[None]):
    key = serializers.CharField()
    url = serializers.URLField()
    form_fields = serializers.DictField(child=serializers.CharField())
    max_bytes = serializers.IntegerField()
    expires_in = serializers.IntegerField()


class ImageKeySerializer(serializers.Serializer[None]):
    key = serializers.CharField(max_length=512)


class ImageUrlSerializer(serializers.Serializer[None]):
    url = serializers.CharField(allow_null=True)


class SingleImageView(APIView):
    """Subclasses define the target object, its field and its storage namespace."""

    field: str = ""
    owner: str = ""
    kind: str = ""

    def get_target(self, request: Request) -> tuple[models.Model, int]:  # pragma: no cover
        raise NotImplementedError

    def _url(self, instance: models.Model) -> str | None:
        file_field = getattr(instance, self.field)
        return str(file_field.url) if file_field else None

    @extend_schema(
        request=ImageKeySerializer, responses={200: ImageUrlSerializer, 400: ErrorCodeSerializer}
    )
    def put(self, request: Request) -> Response:
        instance, owner_id = self.get_target(request)
        serializer = ImageKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            set_image(
                instance,
                self.field,
                serializer.validated_data["key"],
                owner=self.owner,
                owner_id=owner_id,
                kind=self.kind,
            )
        except UploadRuleError as exc:
            return Response({"code": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"url": self._url(instance)})

    @extend_schema(request=None, responses={204: None})
    def delete(self, request: Request) -> Response:
        instance, owner_id = self.get_target(request)
        set_image(instance, self.field, None, owner=self.owner, owner_id=owner_id, kind=self.kind)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SingleImageUploadUrlView(APIView):
    owner: str = ""
    kind: str = ""

    def get_owner_id(self, request: Request) -> int:  # pragma: no cover
        raise NotImplementedError

    @extend_schema(
        request=ImageUploadRequestSerializer,
        responses={200: ImageUploadTicketSerializer, 400: ErrorCodeSerializer},
    )
    def post(self, request: Request) -> Response:
        owner_id = self.get_owner_id(request)
        serializer = ImageUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ticket = request_upload(
                owner=self.owner,
                owner_id=owner_id,
                kind=self.kind,
                content_type=serializer.validated_data["content_type"],
            )
        except UploadRuleError as exc:
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
