"""The single, tested mechanism that isolates data between couples and between partners.

Every API view touching couple or private data MUST use CoupleScopedQuerysetMixin:

- `couple_field` (default "couple"): queryset is filtered by the requester's active couple,
  and new objects are saved with it. Set to None for data that only belongs to its author
  (e.g. private journal), which then requires authentication only.
- `author_field`: set to the requester on create (e.g. "author", "created_by").
- `private = True`: queryset is ALSO filtered by `author_field`, so the partner never sees it.

Objects outside the filtered queryset are answered with 404 (never 403), so their very
existence is not revealed to a partner or a stranger.
"""

from typing import Any

from django.core.exceptions import ImproperlyConfigured
from django.db.models import Model, QuerySet
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.serializers import BaseSerializer

from couples.models import Couple

from .permissions import HasActiveCouple, request_couple


class CoupleScopedQuerysetMixin(GenericAPIView[Any]):
    couple_field: str | None = "couple"
    author_field: str | None = None
    private: bool = False

    #: Extra permissions checked after authentication and couple membership.
    extra_permission_classes: tuple[type[BasePermission], ...] = ()

    def get_permissions(self) -> list[BasePermission]:
        classes: list[type[BasePermission]] = [IsAuthenticated]
        if self.couple_field is not None:
            classes.append(HasActiveCouple)
        classes.extend(self.extra_permission_classes)
        return [cls() for cls in classes]

    @property
    def couple(self) -> Couple:
        couple = request_couple(self.request)
        if couple is None:  # pragma: no cover - guarded by HasActiveCouple
            raise ImproperlyConfigured("couple accessed without HasActiveCouple")
        return couple

    def get_queryset(self) -> QuerySet[Any]:
        if self.private and not self.author_field:
            raise ImproperlyConfigured("private views need an author_field")
        if self.couple_field is None and not (self.private and self.author_field):
            raise ImproperlyConfigured("views without couple_field must be private")
        queryset: QuerySet[Any] = super().get_queryset()
        if self.couple_field is not None:
            queryset = queryset.filter(**{self.couple_field: self.couple})
        if self.private and self.author_field:
            queryset = queryset.filter(**{self.author_field: self.request.user})
        return queryset

    def scoped_save_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        if self.couple_field is not None:
            kwargs[self.couple_field] = self.couple
        if self.author_field:
            kwargs[self.author_field] = self.request.user
        return kwargs

    def perform_create(self, serializer: BaseSerializer[Model]) -> None:
        serializer.save(**self.scoped_save_kwargs())

    def perform_update(self, serializer: BaseSerializer[Model]) -> None:
        # Scope fields are re-asserted: an object can never move to another couple/author.
        instance = serializer.instance
        kwargs = {k: getattr(instance, k) for k in self.scoped_save_kwargs()}
        serializer.save(**kwargs)
