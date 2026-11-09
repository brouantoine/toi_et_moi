from django.contrib import admin

from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin[Message]):
    list_display = ("kind", "created_at")
    # Message contents are intentionally not listed in the admin.
