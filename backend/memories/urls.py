from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("memories", views.MemoryViewSet, basename="memory")

urlpatterns = router.urls
