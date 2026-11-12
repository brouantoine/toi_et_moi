from typing import Any

from django import forms
from django.contrib import admin, messages
from django.http import HttpRequest

from accounts.models import User

from . import services
from .models import PlusGrant, StoreSubscription


class PlusGrantForm(forms.ModelForm[PlusGrant]):
    """Offer Plus by email: the person's couple gets it, both partners."""

    email = forms.EmailField(label="Email de la personne")

    class Meta:
        model = PlusGrant
        fields = ["email", "days", "reason"]

    def clean_email(self) -> str:
        email = str(self.cleaned_data["email"]).strip().lower()
        if not User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Aucun compte avec cet email.")
        return email


@admin.register(PlusGrant)
class PlusGrantAdmin(admin.ModelAdmin[PlusGrant]):
    """Offrir Plus : autant que tu veux, à qui tu veux, sans paiement."""

    form = PlusGrantForm
    list_display = ["user", "days", "reason", "starts_at", "ends_at", "granted_by", "created_at"]
    search_fields = ["user__email", "reason"]
    readonly_fields = ["starts_at", "ends_at", "granted_by"]

    def get_fields(self, request: HttpRequest, obj: PlusGrant | None = None) -> Any:
        if obj is None:
            return ["email", "days", "reason"]
        return ["user", "days", "reason", "starts_at", "ends_at", "granted_by"]

    def save_model(self, request: HttpRequest, obj: PlusGrant, form: Any, change: bool) -> None:
        if change:
            super().save_model(request, obj, form, change)
            services.recompute_for(obj.user)
            return
        user = User.objects.get(email__iexact=form.cleaned_data["email"])
        gift = services.grant(
            user,
            form.cleaned_data["days"],
            form.cleaned_data.get("reason", ""),
            by=request.user if isinstance(request.user, User) else None,
        )
        obj.pk = gift.pk
        messages.success(request, f"{gift.days} jours de Plus offerts à {user.email}.")

    def delete_model(self, request: HttpRequest, obj: PlusGrant) -> None:
        user = obj.user
        super().delete_model(request, obj)
        services.recompute_for(user)


@admin.register(StoreSubscription)
class StoreSubscriptionAdmin(admin.ModelAdmin[StoreSubscription]):
    list_display = ["user", "store", "product_id", "expires_at", "will_renew", "sandbox"]
    list_filter = ["store", "sandbox", "will_renew"]
    search_fields = ["user__email", "product_id"]
    readonly_fields = [f.name for f in StoreSubscription._meta.fields]


@admin.action(description="Offrir 30 jours de Plus à ces couples")
def offer_a_month(modeladmin: Any, request: HttpRequest, queryset: Any) -> None:
    by = request.user if isinstance(request.user, User) else None
    count = 0
    for couple in queryset:
        first = couple.members.first()
        if first is not None:
            services.grant(first, 30, "offert depuis l'admin (couples)", by=by)
            count += 1
    messages.success(request, f"Un mois de Plus offert à {count} couple(s).")
