from django.urls import path

from . import views

urlpatterns = [
    path(
        "billing/revenuecat/",
        views.RevenueCatWebhookView.as_view(),
        name="billing-revenuecat",
    ),
]
