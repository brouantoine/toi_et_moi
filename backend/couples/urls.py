from django.urls import path

from . import photo_views, views

urlpatterns = [
    path("couple/", views.CoupleView.as_view(), name="couple"),
    path("couple/join/", views.JoinCoupleView.as_view(), name="couple-join"),
    path("couple/solo-test/", views.SoloTestView.as_view(), name="couple-solo-test"),
    path("couple/invitation/", views.NewInvitationView.as_view(), name="couple-invitation"),
    path("couple/photo/", photo_views.CouplePhotoView.as_view(), name="couple-photo"),
    path(
        "couple/photo/upload-url/",
        photo_views.CouplePhotoUploadUrlView.as_view(),
        name="couple-photo-upload-url",
    ),
]
