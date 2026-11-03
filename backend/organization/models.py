from __future__ import annotations

from django.conf import settings
from django.db import models


class EventKind(models.TextChoices):
    EVENT = "event", "Événement"
    BIRTHDAY = "birthday", "Anniversaire"
    REUNION = "reunion", "Retrouvailles"


class Recurrence(models.TextChoices):
    NONE = "none", "Aucune"
    YEARLY = "yearly", "Chaque année"


class Event(models.Model):
    """Shared calendar entry. `date` is the local day; timed events also keep UTC instants."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="events")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=EventKind.choices, default=EventKind.EVENT)
    place = models.CharField(max_length=200, blank=True)
    all_day = models.BooleanField(default=True)
    date = models.DateField()
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    recurrence = models.CharField(max_length=8, choices=Recurrence.choices, default=Recurrence.NONE)
    #: Who the event concerns; null means both of us.
    concerns = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reminder_minutes = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "starts_at", "id"]
        indexes = [models.Index(fields=["couple", "date"])]

    def __str__(self) -> str:
        return self.title


class ListKind(models.TextChoices):
    GROCERIES = "groceries", "Courses"
    FREE = "free", "Libre"


class SharedList(models.Model):
    """A shared list (groceries or free), ordered by `position`."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="lists")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=ListKind.choices, default=ListKind.FREE)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.title


class ListItem(models.Model):
    list = models.ForeignKey(SharedList, on_delete=models.CASCADE, related_name="items")
    text = models.CharField(max_length=200)
    done = models.BooleanField(default=False)
    done_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    done_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.text


class ChoreRecurrence(models.TextChoices):
    NONE = "none", "Une fois"
    DAILY = "daily", "Chaque jour"
    WEEKLY = "weekly", "Chaque semaine"
    MONTHLY = "monthly", "Chaque mois"


class Chore(models.Model):
    """A household task. Recurring ones move to their next due date when done."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="chores")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=120)
    #: Who carries it; null means both of us.
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    recurrence = models.CharField(
        max_length=8, choices=ChoreRecurrence.choices, default=ChoreRecurrence.NONE
    )
    due_date = models.DateField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    last_done_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = [models.F("due_date").asc(nulls_last=True), "id"]
        indexes = [models.Index(fields=["couple", "due_date"])]

    def __str__(self) -> str:
        return self.title


class ExpenseCategory(models.TextChoices):
    GROCERIES = "groceries", "Courses"
    HOME = "home", "Maison"
    OUTINGS = "outings", "Sorties"
    TRAVEL = "travel", "Voyages"
    GIFTS = "gifts", "Cadeaux"
    HEALTH = "health", "Santé"
    OTHER = "other", "Autre"


class Split(models.TextChoices):
    EQUAL = "equal", "50/50"
    CUSTOM = "custom", "Personnalisée"


class Expense(models.Model):
    """A shared expense. Amounts are integers in the currency's smallest unit."""

    couple = models.ForeignKey("couples.Couple", on_delete=models.CASCADE, related_name="expenses")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    title = models.CharField(max_length=120)
    amount = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    category = models.CharField(
        max_length=10, choices=ExpenseCategory.choices, default=ExpenseCategory.OTHER
    )
    spent_on = models.DateField()
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    split = models.CharField(max_length=6, choices=Split.choices, default=Split.EQUAL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-spent_on", "-id"]
        indexes = [models.Index(fields=["couple", "-spent_on"])]

    def __str__(self) -> str:
        return self.title


class ExpenseShare(models.Model):
    """What each member carries of an expense (two rows per expense)."""

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="shares")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    amount = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["expense", "user"], name="unique_expense_share")
        ]

    def __str__(self) -> str:
        return f"{self.amount} ({self.expense_id})"


class Settlement(models.Model):
    """A reimbursement from one member to the other."""

    couple = models.ForeignKey(
        "couples.Couple", on_delete=models.CASCADE, related_name="settlements"
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    amount = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.amount} {self.currency}"
