from rest_framework.routers import SimpleRouter

from . import list_views, views

router = SimpleRouter()
router.register("events", views.EventViewSet, basename="event")
router.register("lists", list_views.SharedListViewSet, basename="list")
router.register(r"lists/(?P<list_pk>\d+)/items", list_views.ListItemViewSet, basename="list-item")

urlpatterns = router.urls
