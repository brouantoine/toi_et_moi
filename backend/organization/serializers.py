from __future__ import annotations

from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from rest_framework import serializers

from core.auth import current_user

from .models import Chore, Event, ListItem, SharedList


class ConcernsField(serializers.ChoiceField):
    """`me` / `you` / `us`, always relative to the person reading or writing."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(choices=["me", "you", "us"], **kwargs)

    def to_representation(self, value: Any) -> str:
        if value is None:
            return "us"
        user = current_user(self.context["request"])
        return "me" if value.pk == user.pk else "you"

    def to_internal_value(self, data: Any) -> Any:
        choice = super().to_internal_value(data)
        if choice == "us":
            return None
        request = self.context["request"]
        user = current_user(request)
        if choice == "me":
            return user
        return self.context["couple"].partner_of(user)


class EventSerializer(serializers.ModelSerializer[Event]):
    title = serializers.CharField(max_length=120, trim_whitespace=True)
    concerns = ConcernsField(required=False)
    date = serializers.DateField(required=False)

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "kind",
            "place",
            "all_day",
            "date",
            "starts_at",
            "ends_at",
            "recurrence",
            "concerns",
            "reminder_minutes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance: Event) -> dict[str, Any]:
        data = super().to_representation(instance)
        if instance.concerns_id is None:
            data["concerns"] = "us"
        return data

    def validate_reminder_minutes(self, value: int | None) -> int | None:
        if value is not None and value > 60 * 24 * 30:
            raise serializers.ValidationError("too_far", code="too_far")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.instance is None:
            attrs.setdefault("concerns", None)  # nobody named: it concerns both of us
        merged = {**self._current(), **attrs}
        if merged.get("all_day", True):
            if not merged.get("date"):
                raise serializers.ValidationError({"date": "required"}, code="required")
            attrs["starts_at"] = attrs["ends_at"] = None
            return attrs
        starts_at, ends_at = merged.get("starts_at"), merged.get("ends_at")
        if not starts_at:
            raise serializers.ValidationError({"starts_at": "required"}, code="required")
        if ends_at and ends_at < starts_at:
            raise serializers.ValidationError({"ends_at": "before_start"}, code="before_start")
        # The calendar day is the one of the person who sets the time.
        attrs["date"] = timezone.localtime(starts_at, _tz(self.context["request"])).date()
        return attrs

    def _current(self) -> dict[str, Any]:
        instance = self.instance
        if not isinstance(instance, Event):
            return {}
        return {
            "all_day": instance.all_day,
            "date": instance.date,
            "starts_at": instance.starts_at,
            "ends_at": instance.ends_at,
        }


def _tz(request: Any) -> ZoneInfo:
    try:
        return ZoneInfo(current_user(request).timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


class OccurrenceSerializer(serializers.Serializer[Any]):
    """One day on which an event happens (yearly events have one per year)."""

    date = serializers.DateField()
    starts_at = serializers.DateTimeField(allow_null=True)
    ends_at = serializers.DateTimeField(allow_null=True)
    event = EventSerializer()


class ReorderSerializer(serializers.Serializer[Any]):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=500)


class SharedListSerializer(serializers.ModelSerializer[SharedList]):
    title = serializers.CharField(max_length=80, trim_whitespace=True)
    open_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = SharedList
        fields = ["id", "title", "kind", "position", "open_items", "created_at", "updated_at"]
        read_only_fields = ["id", "position", "open_items", "created_at", "updated_at"]


class ListItemSerializer(serializers.ModelSerializer[ListItem]):
    text = serializers.CharField(max_length=200, trim_whitespace=True)
    done_by = serializers.SerializerMethodField()

    class Meta:
        model = ListItem
        fields = ["id", "text", "done", "done_by", "done_at", "position", "created_at"]
        read_only_fields = ["id", "done_by", "done_at", "position", "created_at"]

    def get_done_by(self, obj: ListItem) -> str | None:
        """`me` / `you`: who ticked it, relative to the reader (no tally is ever kept)."""
        if obj.done_by_id is None:
            return None
        return "me" if obj.done_by_id == current_user(self.context["request"]).pk else "you"


class ChoreSerializer(serializers.ModelSerializer[Chore]):
    title = serializers.CharField(max_length=120, trim_whitespace=True)
    assignee = ConcernsField(required=False)

    class Meta:
        model = Chore
        fields = [
            "id",
            "title",
            "assignee",
            "recurrence",
            "due_date",
            "done_at",
            "last_done_at",
            "created_at",
        ]
        read_only_fields = ["id", "done_at", "last_done_at", "created_at"]

    def to_representation(self, instance: Chore) -> dict[str, Any]:
        data = super().to_representation(instance)
        if instance.assignee_id is None:
            data["assignee"] = "us"
        return data

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.instance is None:
            attrs.setdefault("assignee", None)
        return attrs


class ChoreWeekSerializer(serializers.Serializer[Any]):
    """Who carries what this week: three plain lists, never counts or comparisons."""

    start = serializers.DateField()
    end = serializers.DateField()
    me = ChoreSerializer(many=True)
    you = ChoreSerializer(many=True)
    us = ChoreSerializer(many=True)
