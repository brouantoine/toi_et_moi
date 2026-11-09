from django.conf import settings
from django.db import models


class HomeCity(models.Model):
    """The city a person chose to compare with their partner (never a GPS position).

    `label` keeps the spelling they picked ("Londres"); coordinates are looked up in
    the offline city index and never stored nor sent to the partner.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="home_city"
    )
    city_id = models.PositiveIntegerField()
    label = models.CharField(max_length=80)
    sharing = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user_id}: {self.label}"
