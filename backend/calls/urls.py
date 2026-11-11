from django.urls import path

from . import views

urlpatterns = [
    path("calls/", views.StartCallView.as_view(), name="calls-start"),
    path("calls/current/", views.CurrentCallView.as_view(), name="calls-current"),
    path(
        "calls/<int:call_id>/accept/",
        views.CallActionView.as_view(action="accept"),
        name="calls-accept",
    ),
    path(
        "calls/<int:call_id>/decline/",
        views.CallActionView.as_view(action="decline"),
        name="calls-decline",
    ),
    path(
        "calls/<int:call_id>/end/",
        views.CallActionView.as_view(action="end"),
        name="calls-end",
    ),
]
