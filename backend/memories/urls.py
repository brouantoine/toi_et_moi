from rest_framework.routers import SimpleRouter

from . import photo_views, views

router = SimpleRouter()
router.register("memories", views.MemoryViewSet, basename="memory")
router.register(
    r"memories/(?P<memory_pk>\d+)/photos", photo_views.MemoryPhotoViewSet, basename="memory-photo"
)

urlpatterns = router.urls
