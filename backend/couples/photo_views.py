from django.db import models
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from core.permissions import HasActiveCouple, request_couple
from core.upload_views import SingleImageUploadUrlView, SingleImageView


def _couple_id(request: Request) -> int:
    couple = request_couple(request)
    assert couple is not None  # guaranteed by HasActiveCouple  # noqa: S101
    return couple.pk


class CouplePhotoUploadUrlView(SingleImageUploadUrlView):
    permission_classes = [IsAuthenticated, HasActiveCouple]
    owner = "couples"
    kind = "photo"

    def get_owner_id(self, request: Request) -> int:
        return _couple_id(request)


class CouplePhotoView(SingleImageView):
    """Shared couple photo: either partner can set or remove it."""

    permission_classes = [IsAuthenticated, HasActiveCouple]
    field = "photo"
    owner = "couples"
    kind = "photo"

    def get_target(self, request: Request) -> tuple[models.Model, int]:
        couple = request_couple(request)
        assert couple is not None  # noqa: S101
        return couple, couple.pk
