from __future__ import annotations

from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from rest_framework import serializers

from core.auth import current_user

from .models import Chore, Event, Expense, ListItem, SharedList, Split


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


class PayerField(serializers.ChoiceField):
    """`me` / `you`: who paid, relative to the reader."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(choices=["me", "you"], **kwargs)

    def to_representation(self, value: Any) -> str:
        return "me" if value.pk == current_user(self.context["request"]).pk else "you"

    def to_internal_value(self, data: Any) -> Any:
        choice = super().to_internal_value(data)
        user = current_user(self.context["request"])
        return user if choice == "me" else self.context["couple"].partner_of(user)


MAX_AMOUNT = 100_000_000


class ExpenseSerializer(serializers.ModelSerializer[Expense]):
    """Amounts in the currency's smallest unit (cents). Shares are relative to the reader."""

    title = serializers.CharField(max_length=120, trim_whitespace=True)
    amount = serializers.IntegerField(min_value=1, max_value=MAX_AMOUNT)
    currency = serializers.RegexField(r"^[A-Z]{3}$", required=False)
    spent_on = serializers.DateField(required=False)
    paid_by = PayerField(required=False)
    my_share = serializers.IntegerField(min_value=0, max_value=MAX_AMOUNT, required=False)
    partner_share = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "title",
            "amount",
            "currency",
            "category",
            "spent_on",
            "paid_by",
            "split",
            "my_share",
            "partner_share",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def _shares(self, obj: Expense) -> tuple[int, int]:
        me = current_user(self.context["request"]).pk
        mine = theirs = 0
        for share in obj.shares.all():
            if share.user_id == me:
                mine = share.amount
            else:
                theirs = share.amount
        return mine, theirs

    def to_representation(self, instance: Expense) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["my_share"] = self._shares(instance)[0]
        return data

    def get_partner_share(self, obj: Expense) -> int:
        return self._shares(obj)[1]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance if isinstance(self.instance, Expense) else None
        split = attrs.get("split", instance.split if instance else Split.EQUAL)
        amount = attrs.get("amount", instance.amount if instance else 0)
        if split == Split.CUSTOM:
            my_share = attrs.get("my_share")
            if my_share is None and instance is not None and "amount" not in attrs:
                my_share = self._shares(instance)[0]
            if my_share is None:
                raise serializers.ValidationError({"my_share": "required"}, code="required")
            if my_share > amount:
                raise serializers.ValidationError({"my_share": "above_amount"}, code="above_amount")
            attrs["my_share"] = my_share
        return attrs


class BalanceSerializer(serializers.Serializer[Any]):
    """Per currency. `amount` is always positive; `direction` says who owes whom."""

    currency = serializers.CharField()
    amount = serializers.IntegerField()
    direction = serializers.ChoiceField(choices=["partner_owes_me", "i_owe_partner", "settled"])


class SettleSerializer(serializers.Serializer[Any]):
    currency = serializers.RegexField(r"^[A-Z]{3}$")
