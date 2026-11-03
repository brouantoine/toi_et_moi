from django.db import models
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from core.auth import current_user
from core.upload_views import SingleImageUploadUrlView, SingleImageView


class AvatarUploadUrlView(SingleImageUploadUrlView):
    permission_classes = [IsAuthenticated]
    owner = "users"
    kind = "avatars"

    def get_owner_id(self, request: Request) -> int:
        return current_user(request).pk


class AvatarView(SingleImageView):
    """PUT {key} sets my photo after upload; DELETE removes it (file really deleted)."""

    permission_classes = [IsAuthenticated]
    field = "avatar"
    owner = "users"
    kind = "avatars"

    def get_target(self, request: Request) -> tuple[models.Model, int]:
        user = current_user(request)
        return user, user.pk
