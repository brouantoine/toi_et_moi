from django.conf import settings
from django.db import models


class SharedThing(models.Model):
    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=50)


class PrivateThing(models.Model):
    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.CharField(max_length=50)


class PersonalThing(models.Model):
    """Private data that outlives the couple (no couple FK)."""

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.CharField(max_length=50)
