from django.urls import path

from . import views

urlpatterns = [
    path("notifications/devices/", views.DeviceView.as_view(), name="push-device"),
    path(
        "notifications/devices/forget/", views.ForgetDeviceView.as_view(), name="push-device-forget"
    ),
    path(
        "notifications/preferences/",
        views.PreferenceView.as_view(),
        name="notification-preferences",
    ),
]
