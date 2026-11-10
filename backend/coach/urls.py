from django.urls import path

from . import views

urlpatterns = [
    path("coach/", views.CoachThreadView.as_view(), name="coach"),
    path("coach/consent/", views.CoachConsentView.as_view(), name="coach-consent"),
    path("coach/messages/", views.CoachPostView.as_view(), name="coach-messages"),
]
