from django.urls import path

from . import views

urlpatterns = [
    path("places/search/", views.CitySearchView.as_view(), name="places-search"),
    path("couple/distance/", views.DistanceView.as_view(), name="couple-distance"),
]
