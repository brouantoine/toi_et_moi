from django.conf import settings
from django.db import models


class PlusGrant(models.Model):
    """Bolingo Plus offered by the team (gift, partner, tester): no purchase involved.

    Granted to a person; it covers their couple, both partners, for as long as it lasts.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="plus_grants"
    )
    days = models.PositiveIntegerField()
    reason = models.CharField(max_length=200, blank=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="plus_granted",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Plus offert"
        verbose_name_plural = "Plus offerts"

    def __str__(self) -> str:
        return f"{self.days} days of Plus for user {self.user_id}"


class Store(models.TextChoices):
    APP_STORE = "app_store"
    PLAY_STORE = "play_store"
    OTHER = "other"


class StoreSubscription(models.Model):
    """A Plus subscription bought in a store, kept in sync by the RevenueCat webhook."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store_subscriptions"
    )
    store = models.CharField(max_length=12, choices=Store.choices, default=Store.OTHER)
    product_id = models.CharField(max_length=120)
    expires_at = models.DateTimeField(null=True, blank=True)
    will_renew = models.BooleanField(default=True)
    sandbox = models.BooleanField(default=False)
    last_event_id = models.CharField(max_length=120, blank=True)
    last_event_type = models.CharField(max_length=40, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "product_id"], name="one_row_per_product")
        ]
        verbose_name = "abonnement des stores"
        verbose_name_plural = "abonnements des stores"

    def __str__(self) -> str:
        return f"{self.product_id} for user {self.user_id}"
