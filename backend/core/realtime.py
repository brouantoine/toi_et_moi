"""Real-time sync between the two phones of a couple.

Protocol (JSON over WebSocket at /ws/v1/sync/):
1. The client connects, then sends {"type": "auth", "token": "<access JWT>"} within 10 s.
   The token never travels in the URL (URLs end up in server logs).
2. The server answers {"type": "ready"} and joins the couple's group, or closes with 4401.
3. The server then pushes {"type": "changed", "resource": ..., "id": ..., "action": ...}.
   No content is ever pushed: the client refetches through the REST API, which remains
   the only place where access is checked.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, cast

from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer
from django.db import transaction
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from couples.services import get_active_couple

AUTH_TIMEOUT_SECONDS = 10
CLOSE_UNAUTHORIZED = 4401


def couple_group(couple_id: int) -> str:
    return f"couple.{couple_id}"


def _couple_id_for_token(token: str) -> int | None:
    try:
        user_id = AccessToken(token)["user_id"]  # type: ignore[arg-type]
        user = User.objects.get(pk=user_id, is_active=True)
    except (TokenError, KeyError, User.DoesNotExist):
        return None
    couple = get_active_couple(user)
    return couple.pk if couple else None


_couple_for_token = cast(
    Callable[[str], Awaitable[int | None]], database_sync_to_async(_couple_id_for_token)
)


class SyncConsumer(AsyncJsonWebsocketConsumer):  # type: ignore[misc]
    group: str | None = None
    _auth_timer: asyncio.Task[None] | None = None

    async def connect(self) -> None:
        await self.accept()
        self._auth_timer = asyncio.create_task(self._close_if_silent())

    async def _close_if_silent(self) -> None:
        await asyncio.sleep(AUTH_TIMEOUT_SECONDS)
        if self.group is None:
            await self.close(code=CLOSE_UNAUTHORIZED)

    async def receive_json(self, content: Any, **kwargs: Any) -> None:
        if not isinstance(content, dict):
            return
        if self.group is None:
            if content.get("type") != "auth" or not isinstance(content.get("token"), str):
                await self.close(code=CLOSE_UNAUTHORIZED)
                return
            couple_id = await _couple_for_token(content["token"])
            if couple_id is None:
                await self.close(code=CLOSE_UNAUTHORIZED)
                return
            self.group = couple_group(couple_id)
            await self.channel_layer.group_add(self.group, self.channel_name)
            await self.send_json({"type": "ready"})
        elif content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def disconnect(self, code: int) -> None:
        if self._auth_timer:
            self._auth_timer.cancel()
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def sync_changed(self, event: dict[str, Any]) -> None:
        await self.send_json({k: v for k, v in event.items() if k != "type"} | {"type": "changed"})


def notify_changed(
    couple_id: int, resource: str, object_id: int, action: str, **extra: Any
) -> None:
    """Tells both phones that something changed, once the transaction is committed."""

    def send() -> None:
        layer = get_channel_layer()
        if layer is None:  # pragma: no cover - always configured
            return
        payload = {"type": "sync.changed", "resource": resource, "id": object_id, "action": action}
        async_to_sync(layer.group_send)(couple_group(couple_id), payload | extra)

    transaction.on_commit(send)
