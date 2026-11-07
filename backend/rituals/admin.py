from django.contrib import admin

from .models import MorningMood


@admin.register(MorningMood)
class MorningMoodAdmin(admin.ModelAdmin[MorningMood]):
    list_display = ("day", "mood", "need")
