from typing import Any

from django.db.models import QuerySet
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.auth import current_user
from core.mixins import CoupleScopedQuerysetMixin
from core.pagination import DefaultCursorPagination

from . import services
from .models import Memory, MemoryReaction, MemoryType
from .serializers import HeartSerializer, MemorySerializer, OnThisDaySerializer


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

    @extend_schema(request=None, responses={200: HeartSerializer})
    @action(detail=True, methods=["post", "delete"])
    def heart(self, request: Request, pk: str | None = None) -> Response:
        """A single gentle heart: POST gives it, DELETE takes it back. Never counted."""
        memory = self.get_object()
        user = current_user(request)
        if request.method == "POST":
            MemoryReaction.objects.get_or_create(memory=memory, user=user)
            return Response({"my_heart": True}, status=status.HTTP_200_OK)
        MemoryReaction.objects.filter(memory=memory, user=user).delete()
        return Response({"my_heart": False}, status=status.HTTP_200_OK)

    @extend_schema(responses={200: OnThisDaySerializer})
    @action(detail=False, methods=["get"], url_path="on-this-day")
    def on_this_day(self, request: Request) -> Response:
        """N years ago today, computed in the requester time zone."""
        today = services.local_today(current_user(request).timezone)
        items = services.on_this_day(self.couple.pk, today)
        context = self.get_serializer_context()
        return Response(
            {
                "date": today.isoformat(),
                "items": [
                    {"years_ago": years, "memory": MemorySerializer(m, context=context).data}
                    for m, years in items
                ],
            }
        )
