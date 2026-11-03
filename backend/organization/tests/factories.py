import datetime as dt

import factory

from organization.models import Event


class EventFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Event

    title = factory.Sequence(lambda n: f"Événement {n}")
    date = dt.date(2026, 5, 10)
    all_day = True
