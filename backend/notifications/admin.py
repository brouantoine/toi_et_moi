from django.contrib import admin

from .models import NotificationPreference, PushDevice


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin[PushDevice]):
    list_display = ("user", "platform", "last_seen_at")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin[NotificationPreference]):
    list_display = ("user", "morning_time", "discreet")
