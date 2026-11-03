"""WebSocket routes."""

from django.urls import path

from core.realtime import SyncConsumer

websocket_urlpatterns = [path("ws/v1/sync/", SyncConsumer.as_asgi())]
