from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.models import User


class CoupleStatus(models.TextChoices):
    PENDING = "pending", "En attente du partenaire"
    ACTIVE = "active", "Actif"
    DISSOLVING = "dissolving", "En dissolution"
    DISSOLVED = "dissolved", "Dissous"


def couple_photo_upload_to(instance: Couple, filename: str) -> str:
    return f"couples/{instance.pk}/photo/{filename}"


class CoupleAccent(models.TextChoices):
    """The couple's colour in the app (mobile `accents` tokens). No pink, by design."""

    ROUGE = "rouge"
    AMBRE = "ambre"
    SAUGE = "sauge"
    LAGON = "lagon"
    BLEU = "bleu"
    VIOLET = "violet"
    ENCRE = "encre"


class Couple(models.Model):
    """Shared space of two people. Every shared entity carries a couple FK."""

    status = models.CharField(
        max_length=12, choices=CoupleStatus.choices, default=CoupleStatus.PENDING
    )
    start_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="EUR")
    accent = models.CharField(
        max_length=12, choices=CoupleAccent.choices, default=CoupleAccent.VIOLET
    )
    photo = models.FileField(upload_to=couple_photo_upload_to, blank=True, max_length=512)
    created_at = models.DateTimeField(auto_now_add=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    dissolution_started_at = models.DateTimeField(null=True, blank=True)
    dissolve_at = models.DateTimeField(null=True, blank=True)
    #: Bolingo Plus, shared by both partners: paid until this moment (set by purchases).
    plus_until = models.DateTimeField(null=True, blank=True)

    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="CoupleMember", related_name="couples"
    )

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"Couple #{self.pk} ({self.status})"

    @property
    def is_active(self) -> bool:
        return self.status == CoupleStatus.ACTIVE

    @property
    def premium(self) -> bool:
        """Bolingo Plus is active for this couple."""
        return bool(self.plus_until and self.plus_until > timezone.now())

    def partner_of(self, user: User) -> User | None:
        return next((m for m in self.members.all() if m.pk != user.pk), None)


class CoupleMember(models.Model):
    """Membership. `is_current` marks the one couple a user currently belongs to."""

    couple = models.ForeignKey(Couple, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    joined_at = models.DateTimeField(default=timezone.now)
    is_current = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["couple", "user"], name="unique_membership"),
            models.UniqueConstraint(
                fields=["user"], condition=Q(is_current=True), name="one_current_couple_per_user"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.couple_id}"


class Invitation(models.Model):
    couple = models.ForeignKey(Couple, on_delete=models.CASCADE, related_name="invitations")
    code = models.CharField(max_length=6, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.code

    @property
    def is_usable(self) -> bool:
        return not self.revoked and self.used_at is None and self.expires_at > timezone.now()
