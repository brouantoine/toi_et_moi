from django.urls import path

from . import views

urlpatterns = [
    path("couple/", views.CoupleView.as_view(), name="couple"),
    path("couple/join/", views.JoinCoupleView.as_view(), name="couple-join"),
    path("couple/invitation/", views.NewInvitationView.as_view(), name="couple-invitation"),
]
