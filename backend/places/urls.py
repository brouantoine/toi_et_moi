from django.urls import path

from . import views

urlpatterns = [
    path("couple/distance/", views.DistanceView.as_view(), name="couple-distance"),
    path(
        "couple/distance/consent/",
        views.DistanceConsentView.as_view(),
        name="couple-distance-consent",
    ),
]
