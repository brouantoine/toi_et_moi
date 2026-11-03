from django.contrib import admin

from .models import Chore, Event, ListItem, SharedList


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
