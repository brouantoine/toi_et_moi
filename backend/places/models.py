from django.conf import settings
from django.db import models


class LocationShare(models.Model):
    """A person's consented position, used ONLY to compute the distance to their partner.

    Read from the phone while the app is open (never in the background). The partner only
    ever receives the rounded distance and the nearest city name, never the coordinates.
    Stopping erases the coordinates at once.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="location_share"
    )
    terms_version = models.PositiveSmallIntegerField()
    consented_at = models.DateTimeField()
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    city_id = models.PositiveIntegerField(null=True, blank=True)
    located_at = models.DateTimeField(null=True, blank=True)
    #: "Continuous sharing": the phone also sends positions while the app is closed.
    continuous = models.BooleanField(default=False)
    continuous_since = models.DateTimeField(null=True, blank=True)
    #: Last "you are sharing continuously" reminder (sent every 30 days).
    reminded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"location of {self.user_id}"

    @property
    def located(self) -> bool:
        return self.latitude is not None and self.longitude is not None


class Proximity(models.Model):
    """Whether the two partners are currently "near" (under 1 km), to alert only once."""

    couple = models.OneToOneField(
        "couples.Couple", on_delete=models.CASCADE, related_name="proximity"
    )
    near = models.BooleanField(default=False)
    alerted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"proximity of couple {self.couple_id}"
