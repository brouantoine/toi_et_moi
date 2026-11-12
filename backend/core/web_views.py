"""Public pages the stores require: privacy policy, terms of use, support (fr/en)."""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

UPDATED = "12 novembre 2026"
UPDATED_EN = "12 November 2026"


def _language(request: HttpRequest) -> str:
    asked = request.GET.get("lang", "")
    if asked in {"fr", "en"}:
        return asked
    header = request.headers.get("Accept-Language", "")
    return "en" if header.lower().startswith("en") else "fr"


def _page(request: HttpRequest, name: str) -> HttpResponse:
    language = _language(request)
    return render(
        request,
        f"web/legal/{name}.{language}.html",
        {
            "brand": settings.BRAND_NAME,
            "entity": settings.LEGAL_ENTITY,
            "address": settings.LEGAL_ADDRESS,
            "support": settings.SUPPORT_EMAIL,
            "updated": UPDATED_EN if language == "en" else UPDATED,
            "LANGUAGE_CODE": language,
            "other_language": "fr" if language == "en" else "en",
        },
    )


def privacy(request: HttpRequest) -> HttpResponse:
    return _page(request, "privacy")


def terms(request: HttpRequest) -> HttpResponse:
    return _page(request, "terms")


def support(request: HttpRequest) -> HttpResponse:
    return _page(request, "support")


def home(request: HttpRequest) -> HttpResponse:
    return _page(request, "home")
