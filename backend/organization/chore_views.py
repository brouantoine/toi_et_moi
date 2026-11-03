from typing import Any

from django.db.models import Q, QuerySet
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.auth import current_user
from memories.services import local_today

from . import services
from .models import Chore
from .serializers import ChoreSerializer, ChoreWeekSerializer
from .views import CoupleContextMixin


@extend_schema_view(
    list=extend_schema(
        parameters=[OpenApiParameter("done", OpenApiTypes.BOOL, description="Finished one-offs")]
    )
)
class ChoreViewSet(CoupleContextMixin, viewsets.ModelViewSet[Chore]):
    """Household tasks. No score, no tally: only who carries what."""

    queryset = Chore.objects.select_related("assignee")
    serializer_class = ChoreSerializer
    pagination_class = None
    author_field = "created_by"

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        if self.action == "list":
            done = self.request.query_params.get("done") in ("1", "true")
            queryset = queryset.filter(done_at__isnull=not done)
        return queryset

    def _today(self, request: Request) -> Any:
        return local_today(current_user(request).timezone)

    @extend_schema(request=None, responses={200: ChoreSerializer})
    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: str | None = None) -> Response:
        """Done: a one-off is closed, a recurring chore moves to its next due date."""
        chore = services.complete_chore(self.get_object(), self._today(request))
        return Response(self.get_serializer(chore).data)

    @extend_schema(request=None, responses={200: ChoreSerializer})
    @action(detail=True, methods=["post"])
    def reopen(self, request: Request, pk: str | None = None) -> Response:
        chore = self.get_object()
        chore.done_at = None
        chore.save(update_fields=["done_at"])
        return Response(self.get_serializer(chore).data)

    @extend_schema(responses={200: ChoreWeekSerializer})
    @action(detail=False, methods=["get"])
    def week(self, request: Request) -> Response:
        """Open chores due this week (or without date), grouped by who carries them."""
        start, end = services.week_bounds(self._today(request))
        chores = (
            super()
            .get_queryset()
            .filter(done_at__isnull=True)
            .filter(Q(due_date__lte=end) | Q(due_date__isnull=True))
        )
        user = current_user(request)
        groups: dict[str, list[Chore]] = {"me": [], "you": [], "us": []}
        for chore in chores:
            key = (
                "us"
                if chore.assignee_id is None
                else "me"
                if chore.assignee_id == user.pk
                else "you"
            )
            groups[key].append(chore)
        payload = {"start": start, "end": end, **groups}
        return Response(ChoreWeekSerializer(payload, context=self.get_serializer_context()).data)
