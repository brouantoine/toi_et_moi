from rest_framework.routers import SimpleRouter

from . import chore_views, list_views, views

router = SimpleRouter()
router.register("events", views.EventViewSet, basename="event")
router.register("lists", list_views.SharedListViewSet, basename="list")
router.register("chores", chore_views.ChoreViewSet, basename="chore")
router.register(r"lists/(?P<list_pk>\d+)/items", list_views.ListItemViewSet, basename="list-item")

urlpatterns = router.urls
