from typing import Any

from django.db.models import QuerySet
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets

from core.mixins import CoupleScopedQuerysetMixin
from core.pagination import DefaultCursorPagination

from . import services
from .models import Memory, MemoryType
from .serializers import MemorySerializer


class MemoryPagination(DefaultCursorPagination):
    ordering = ("-happened_on", "-id")


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("type", OpenApiTypes.STR, enum=MemoryType.values),
            OpenApiParameter("q", OpenApiTypes.STR, description="Full-text search"),
            OpenApiParameter("tag", OpenApiTypes.STR),
        ]
    )
)
class MemoryViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Memory]):
    """Shared memories of the couple, newest first."""

    queryset = Memory.objects.all()
    serializer_class = MemorySerializer
    pagination_class = MemoryPagination
    author_field = "created_by"

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset().prefetch_related("photos", "reactions")
        if self.action != "list":
            return queryset
        params = self.request.query_params
        if (kind := params.get("type")) in MemoryType.values:
            queryset = queryset.filter(type=kind)
        if tag := params.get("tag"):
            queryset = services.filter_by_tag(queryset, tag)
        if text := params.get("q"):
            queryset = services.search(queryset, text)
        return queryset
