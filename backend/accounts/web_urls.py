from django.urls import path

from . import web_views

urlpatterns = [
    path("verify-email/<str:token>/", web_views.verify_email_page, name="web-verify-email"),
    path(
        "reset/<uidb64>/<token>/",
        web_views.WebPasswordResetConfirmView.as_view(),
        name="web-password-reset-confirm",
    ),
    path(
        "reset/done/",
        web_views.WebPasswordResetDoneView.as_view(),
        name="web-password-reset-done",
    ),
]
