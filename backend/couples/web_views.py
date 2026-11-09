"""Public invitation page and app-link association files (PV.5).

The page never touches the database: it only echoes a well-formed code, so it cannot
be used to probe which codes exist, and it never reveals who sent the invitation.
"""

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET

from .services import CODE_ALPHABET, CODE_LENGTH


def _normalize(code: str) -> str | None:
    code = code.upper().replace("-", "")
    if len(code) != CODE_LENGTH or any(char not in CODE_ALPHABET for char in code):
        return None
    return code


@require_GET
def join_page(request: HttpRequest, code: str) -> HttpResponse:
    normalized = _normalize(code)
    if normalized is None:
        raise Http404
    return render(
        request,
        "web/join.html",
        {
            "brand": settings.BRAND_NAME,
            "code": normalized,
            "app_link": f"{settings.APP_SCHEME}://join/{normalized}",
            "ios_store_url": settings.IOS_STORE_URL,
            "android_store_url": settings.ANDROID_STORE_URL,
        },
    )


@require_GET
@cache_control(max_age=3600, public=True)
def apple_app_site_association(request: HttpRequest) -> JsonResponse:
    if not settings.IOS_APP_IDS:
        raise Http404
    return JsonResponse(
        {
            "applinks": {
                "details": [{"appIDs": settings.IOS_APP_IDS, "components": [{"/": "/join/*"}]}]
            }
        }
    )


@require_GET
@cache_control(max_age=3600, public=True)
def asset_links(request: HttpRequest) -> JsonResponse:
    if not (settings.ANDROID_PACKAGE and settings.ANDROID_CERT_FINGERPRINTS):
        raise Http404
    return JsonResponse(
        [
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": settings.ANDROID_PACKAGE,
                    "sha256_cert_fingerprints": settings.ANDROID_CERT_FINGERPRINTS,
                },
            }
        ],
        safe=False,
    )
