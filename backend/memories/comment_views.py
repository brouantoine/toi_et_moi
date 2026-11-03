from typing import Any

from django.db.models import Model, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.serializers import BaseSerializer

from core.mixins import CoupleScopedQuerysetMixin

from .models import Memory, MemoryComment
from .serializers import MemoryCommentSerializer


class MemoryCommentViewSet(
    CoupleScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet[MemoryComment],
):
    """Short comments on a shared memory. Both partners read; only the author deletes."""

    queryset = MemoryComment.objects.select_related("author")
    serializer_class = MemoryCommentSerializer
    couple_field = "memory__couple"
    pagination_class = None

    def get_queryset(self) -> QuerySet[Any]:
        return super().get_queryset().filter(memory_id=self.kwargs["memory_pk"])

    def perform_create(self, serializer: BaseSerializer[Model]) -> None:
        memory = get_object_or_404(Memory, pk=self.kwargs["memory_pk"], couple=self.couple)
        serializer.save(memory=memory, author=self.request.user)

    def perform_destroy(self, instance: MemoryComment) -> None:
        if instance.author_id != self.request.user.pk:
            raise PermissionDenied("not_author")
        instance.delete()
