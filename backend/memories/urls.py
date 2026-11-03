from rest_framework.routers import SimpleRouter

from . import comment_views, photo_views, views

router = SimpleRouter()
router.register("memories", views.MemoryViewSet, basename="memory")
router.register(
    r"memories/(?P<memory_pk>\d+)/photos", photo_views.MemoryPhotoViewSet, basename="memory-photo"
)
router.register(
    r"memories/(?P<memory_pk>\d+)/comments",
    comment_views.MemoryCommentViewSet,
    basename="memory-comment",
)

urlpatterns = router.urls
