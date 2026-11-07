from django.urls import path

from . import views

urlpatterns = [
    path("morning/today/", views.MorningTodayView.as_view(), name="morning-today"),
    path("morning/reply/", views.MorningReplyView.as_view(), name="morning-reply"),
]
