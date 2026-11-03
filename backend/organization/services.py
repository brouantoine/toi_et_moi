"""Calendar rules: occurrences of (yearly) events inside a date range."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from django.db.models import Q, QuerySet

from .models import Event, Recurrence

MAX_RANGE_DAYS = 400


@dataclass(frozen=True)
class Occurrence:
    event: Event
    date: dt.date
    starts_at: dt.datetime | None
    ends_at: dt.datetime | None


def same_day_in_year(day: dt.date, year: int) -> dt.date:
    """The anniversary of `day` in `year`; 29 February falls on 28 February otherwise."""
    try:
        return day.replace(year=year)
    except ValueError:
        return day.replace(year=year, day=28)


def _shift(value: dt.datetime | None, days: int) -> dt.datetime | None:
    return value + dt.timedelta(days=days) if value else None


def occurrences(events: QuerySet[Event], start: dt.date, end: dt.date) -> list[Occurrence]:
    """Every occurrence between `start` and `end` (inclusive), sorted by day then time."""
    candidates = events.filter(
        Q(recurrence=Recurrence.NONE, date__range=(start, end))
        | Q(recurrence=Recurrence.YEARLY, date__lte=end)
    )
    found: list[Occurrence] = []
    for event in candidates:
        if event.recurrence == Recurrence.NONE:
            found.append(Occurrence(event, event.date, event.starts_at, event.ends_at))
            continue
        for year in range(start.year, end.year + 1):
            day = same_day_in_year(event.date, year)
            if start <= day <= end and day >= event.date:
                delta = (day - event.date).days
                found.append(
                    Occurrence(
                        event, day, _shift(event.starts_at, delta), _shift(event.ends_at, delta)
                    )
                )
    epoch = dt.datetime.min.replace(tzinfo=dt.UTC)
    found.sort(key=lambda o: (o.date, o.starts_at or epoch, o.event.pk))
    return found
