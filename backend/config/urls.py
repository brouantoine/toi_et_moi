from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from couples import web_views as couple_web

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("core.urls")),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("couples.urls")),
    path("api/v1/", include("memories.urls")),
    path("api/v1/", include("organization.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("rituals.urls")),
    path("api/v1/", include("messaging.urls")),
    path("api/v1/", include("places.urls")),
    path("api/v1/", include("games.urls")),
    path("account/", include("accounts.web_urls")),
    path("join/<str:code>/", couple_web.join_page, name="web-join"),
    path(
        ".well-known/apple-app-site-association",
        couple_web.apple_app_site_association,
        name="apple-app-site-association",
    ),
    path(".well-known/assetlinks.json", couple_web.asset_links, name="asset-links"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
]
