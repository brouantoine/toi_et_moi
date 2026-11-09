from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("messages", views.MessageViewSet, basename="message")

urlpatterns = router.urls
