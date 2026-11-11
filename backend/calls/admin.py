from django.contrib import admin

from .models import Call


@admin.register(Call)
class CallAdmin(admin.ModelAdmin[Call]):
    list_display = ["id", "couple", "kind", "state", "created_at", "answered_at", "ended_at"]
    list_filter = ["kind", "state"]
    raw_id_fields = ["couple", "caller"]
