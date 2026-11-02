from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from couples.models import Couple
from couples.services import get_active_couple


def request_couple(request: Request) -> Couple | None:
    """Active couple of the requesting user, cached on the request."""
    if not hasattr(request, "_active_couple"):
        user = request.user
        couple = get_active_couple(user) if user.is_authenticated else None
        request._active_couple = couple  # type: ignore[attr-defined]
    return request._active_couple  # type: ignore[attr-defined, no-any-return]


class HasActiveCouple(BasePermission):
    """The user must belong to an active couple to touch the shared space."""

    message = "no_active_couple"

    def has_permission(self, request: Request, view: Any) -> bool:
        return bool(request.user and request.user.is_authenticated) and (
            request_couple(request) is not None
        )
