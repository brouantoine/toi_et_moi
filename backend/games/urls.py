from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("notes", views.NoteViewSet, basename="note")

urlpatterns = [
    path("games/home/", views.GamesHomeView.as_view(), name="games-home"),
    path("games/packs/", views.PackListView.as_view(), name="games-packs"),
    path("games/packs/<str:pack_id>/", views.PackDetailView.as_view(), name="games-pack"),
    path("games/answers/", views.AnswerView.as_view(), name="games-answers"),
    path("games/upload-url/", views.UploadUrlView.as_view(), name="games-upload-url"),
    path("games/adult/", views.AdultPreferenceView.as_view(), name="games-adult"),
    *router.urls,
]
