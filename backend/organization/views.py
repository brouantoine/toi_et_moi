import datetime as dt
from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.mixins import CoupleScopedQuerysetMixin

from . import services
from .models import Event
from .serializers import EventSerializer, OccurrenceSerializer


class EventViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Event]):
    """Shared calendar. Use `occurrences` to read a period (recurrences expanded)."""

    queryset = Event.objects.select_related("concerns")
    serializer_class = EventSerializer
    pagination_class = None
    author_field = "created_by"

    def get_serializer_context(self) -> dict[str, Any]:
        context = dict(super().get_serializer_context())
        if self.request.user.is_authenticated:
            context["couple"] = self.couple
        return context

    @extend_schema(
        parameters=[
            OpenApiParameter("start", OpenApiTypes.DATE, required=True),
            OpenApiParameter("end", OpenApiTypes.DATE, required=True),
        ],
        responses={200: OccurrenceSerializer(many=True)},
    )
    @action(detail=False, methods=["get"])
    def occurrences(self, request: Request) -> Response:
        """Events between `start` and `end` inclusive (at most 400 days)."""
        start, end = _parse_range(request)
        found = services.occurrences(self.get_queryset(), start, end)
        context = self.get_serializer_context()
        data = [
            {"date": o.date, "starts_at": o.starts_at, "ends_at": o.ends_at, "event": o.event}
            for o in found
        ]
        return Response(OccurrenceSerializer(data, many=True, context=context).data)


def _parse_range(request: Request) -> tuple[dt.date, dt.date]:
    field = serializers.DateField()
    try:
        start = field.to_internal_value(request.query_params.get("start", ""))
        end = field.to_internal_value(request.query_params.get("end", ""))
    except serializers.ValidationError as error:
        raise serializers.ValidationError({"range": "invalid"}, code="invalid") from error
    if end < start or (end - start).days > services.MAX_RANGE_DAYS:
        raise serializers.ValidationError({"range": "invalid"}, code="invalid")
    return start, end
