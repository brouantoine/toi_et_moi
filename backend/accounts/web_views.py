"""Small web pages opened from email links (work on any device, with or without the app)."""

from typing import Any

from django.conf import settings
from django.contrib.auth import views as auth_views
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.decorators.http import require_GET

from . import services


@require_GET
def verify_email_page(request: HttpRequest, token: str) -> HttpResponse:
    ok = services.verify_email(token)
    return render(
        request,
        "web/verify_email.html",
        {"ok": ok, "brand": settings.BRAND_NAME},
        status=200 if ok else 400,
    )


class BrandMixin:
    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context: dict[str, Any] = super().get_context_data(**kwargs)  # type: ignore[misc]
        context["brand"] = settings.BRAND_NAME
        return context


class WebPasswordResetConfirmView(BrandMixin, auth_views.PasswordResetConfirmView):
    template_name = "web/password_reset_confirm.html"
    success_url = reverse_lazy("web-password-reset-done")


class WebPasswordResetDoneView(BrandMixin, auth_views.PasswordResetCompleteView):
    template_name = "web/password_reset_done.html"
