from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("notes", views.NoteViewSet, basename="note")

urlpatterns = [
    path("games/home/", views.GamesHomeView.as_view(), name="games-home"),
    path("games/questions/", views.QuestionListView.as_view(), name="games-questions"),
    path("games/answers/", views.AnswerView.as_view(), name="games-answers"),
    path("games/adult/", views.AdultPreferenceView.as_view(), name="games-adult"),
    *router.urls,
]
