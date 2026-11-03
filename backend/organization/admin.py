from django.contrib import admin

from .models import Chore, Event, Expense, ExpenseShare, ListItem, Settlement, SharedList


@admin.register(Event)
class EventAdmin(admin.ModelAdmin[Event]):
    list_display = ("title", "kind", "date", "recurrence", "couple")
    list_filter = ("kind", "recurrence")


class ListItemInline(admin.TabularInline[ListItem, SharedList]):
    model = ListItem
    extra = 0


@admin.register(SharedList)
class SharedListAdmin(admin.ModelAdmin[SharedList]):
    list_display = ("title", "kind", "couple")
    inlines = [ListItemInline]


@admin.register(Chore)
class ChoreAdmin(admin.ModelAdmin[Chore]):
    list_display = ("title", "recurrence", "due_date", "couple")


class ExpenseShareInline(admin.TabularInline[ExpenseShare, Expense]):
    model = ExpenseShare
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin[Expense]):
    list_display = ("title", "amount", "currency", "spent_on", "couple")
    inlines = [ExpenseShareInline]


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin[Settlement]):
    list_display = ("amount", "currency", "created_at", "couple")
