from typing import Any

from rest_framework import serializers, viewsets
from rest_framework.routers import DefaultRouter

from core.mixins import CoupleScopedQuerysetMixin

from .models import PersonalThing, PrivateThing, SharedThing


class SharedSerializer(serializers.ModelSerializer[SharedThing]):
    class Meta:
        model = SharedThing
        fields = ["id", "title", "created_by"]
        read_only_fields = ["created_by"]


class PrivateSerializer(serializers.ModelSerializer[PrivateThing]):
    class Meta:
        model = PrivateThing
        fields = ["id", "body"]


class PersonalSerializer(serializers.ModelSerializer[PersonalThing]):
    class Meta:
        model = PersonalThing
        fields = ["id", "body"]


class SharedViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Any]):
    queryset = SharedThing.objects.all()
    serializer_class = SharedSerializer
    author_field = "created_by"


class PrivateViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Any]):
    queryset = PrivateThing.objects.all()
    serializer_class = PrivateSerializer
    author_field = "author"
    private = True


class PersonalViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Any]):
    queryset = PersonalThing.objects.all()
    serializer_class = PersonalSerializer
    couple_field = None
    author_field = "author"
    private = True


class MisconfiguredViewSet(CoupleScopedQuerysetMixin, viewsets.ModelViewSet[Any]):
    queryset = PersonalThing.objects.all()
    serializer_class = PersonalSerializer
    couple_field = None


router = DefaultRouter()
router.register("shared", SharedViewSet, basename="shared")
router.register("private", PrivateViewSet, basename="private")
router.register("personal", PersonalViewSet, basename="personal")
router.register("broken", MisconfiguredViewSet, basename="broken")
urlpatterns = router.urls
