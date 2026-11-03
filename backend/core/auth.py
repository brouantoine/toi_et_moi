from typing import cast

from rest_framework.request import Request

from accounts.models import User


def current_user(request: Request) -> User:
    """The authenticated user (views using it require IsAuthenticated)."""
    return cast(User, request.user)
