from typing import Any, cast

from django.db.models import Count, Model, Q, QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from core.auth import current_user
from core.mixins import CoupleScopedQuerysetMixin

from . import services
from .models import ListItem, SharedList
from .serializers import ListItemSerializer, ReorderSerializer, SharedListSerializer


def _apply_order(queryset: QuerySet[Any], request: Request) -> Response:
    payload = ReorderSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    try:
        services.reorder(queryset, payload.validated_data["ids"])
    except ValueError as error:
        raise serializers.ValidationError({"ids": "mismatch"}, code="mismatch") from error
    return Response(status=status.HTTP_204_NO_CONTENT)


class SharedListViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[SharedList]):
    """Shared lists, in the couple's order."""

    # Explicit order: Meta.ordering is ignored by aggregated (GROUP BY) queries.
    queryset = SharedList.objects.annotate(
        open_items=Count("items", filter=Q(items__done=False))
    ).order_by("position", "id")
    serializer_class = SharedListSerializer
    pagination_class = None
    author_field = "created_by"

    def perform_create(self, serializer: BaseSerializer[Model]) -> None:
        position = services.next_position(SharedList.objects.filter(couple=self.couple))
        serializer.save(position=position, **self.scoped_save_kwargs())

    @extend_schema(request=ReorderSerializer, responses={204: None})
    @action(detail=False, methods=["post"])
    def reorder(self, request: Request) -> Response:
        return _apply_order(SharedList.objects.filter(couple=self.couple), request)


class ListItemViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[ListItem]):
    """Items of one list. Ticking records who did it, never a count per person."""

    queryset = ListItem.objects.all()
    serializer_class = ListItemSerializer
    couple_field = "list__couple"
    pagination_class = None

    @property
    def parent(self) -> SharedList:
        # 404 for a list outside the couple, even on the collection itself.
        return get_object_or_404(SharedList, pk=self.kwargs["list_pk"], couple=self.couple)

    def get_queryset(self) -> QuerySet[Any]:
        return super().get_queryset().filter(list=self.parent)

    def perform_create(self, serializer: BaseSerializer[Model]) -> None:
        parent = self.parent
        position = services.next_position(parent.items.all())
        serializer.save(list=parent, position=position, created_by=self.request.user)

    def perform_update(self, serializer: BaseSerializer[Model]) -> None:
        item = cast(ListItem, serializer.instance)
        done = serializer.validated_data.get("done", item.done)
        extra: dict[str, Any] = {}
        if done and not item.done:
            extra = {"done_by": current_user(self.request), "done_at": timezone.now()}
        elif not done and item.done:
            extra = {"done_by": None, "done_at": None}
        serializer.save(**extra)

    @extend_schema(request=ReorderSerializer, responses={204: None})
    @action(detail=False, methods=["post"])
    def reorder(self, request: Request, list_pk: str | None = None) -> Response:
        return _apply_order(self.parent.items.all(), request)

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=["post"], url_path="clear-done")
    def clear_done(self, request: Request, list_pk: str | None = None) -> Response:
        """Removes ticked items (e.g. after shopping)."""
        self.parent.items.filter(done=True).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
