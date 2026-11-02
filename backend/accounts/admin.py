from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin[User]):
    ordering = ["id"]
    list_display = ["email", "first_name", "nickname", "email_verified", "is_staff"]
    search_fields = ["email", "first_name", "nickname"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profil", {"fields": ("first_name", "nickname", "birth_date", "language", "timezone")}),
        ("Heures calmes", {"fields": ("quiet_hours_start", "quiet_hours_end")}),
        (
            "Droits",
            {"fields": ("is_active", "is_staff", "is_superuser", "email_verified")},
        ),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "first_name", "password1", "password2")}),
    )
