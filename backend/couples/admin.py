from django.contrib import admin

from .models import Couple, CoupleMember, Invitation


class CoupleMemberInline(admin.TabularInline[CoupleMember, Couple]):
    model = CoupleMember
    extra = 0
    raw_id_fields = ["user"]


@admin.register(Couple)
class CoupleAdmin(admin.ModelAdmin[Couple]):
    list_display = ["id", "status", "start_date", "currency", "plus_until", "created_at"]
    list_filter = ["status"]
    inlines = [CoupleMemberInline]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin[Invitation]):
    list_display = ["code", "couple", "expires_at", "used_at", "revoked"]
    raw_id_fields = ["couple", "created_by"]
