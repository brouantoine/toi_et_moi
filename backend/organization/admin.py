from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin[Event]):
    list_display = ("title", "kind", "date", "recurrence", "couple")
    list_filter = ("kind", "recurrence")
