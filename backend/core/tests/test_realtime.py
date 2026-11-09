"""WebSocket sync: authentication by first message, couple isolation, change events.

Each test is one async scenario run once: the communicator must live in a single loop.
"""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import UserFactory
from config.asgi import application
from couples.tests.factories import make_couple
from organization.models import SharedList

pytestmark = pytest.mark.django_db(transaction=True)


def run(scenario: Callable[[], Awaitable[None]]) -> None:
    async_to_sync(scenario)()


def token(user: Any) -> str:
    return str(AccessToken.for_user(user))


def api_as(user: Any) -> Callable[..., Awaitable[Any]]:
    client = APIClient()
    client.force_authenticate(user)

    def call(method: str, url: str, data: Any = None) -> Any:
        response = getattr(client, method)(url, data, format="json")
        return response.json() if response.content else None

    return sync_to_async(call)


async def open_socket(auth: Any) -> tuple[WebsocketCommunicator, Any]:
    ws = WebsocketCommunicator(application, "/ws/v1/sync/")
    connected, _ = await ws.connect()
    assert connected
    await ws.send_json_to(auth)
    return ws, await ws.receive_output(timeout=2)


def is_ready(message: Any) -> bool:
    return bool(message["type"] == "websocket.send" and '"ready"' in message["text"])


def closed_unauthorized(message: Any) -> bool:
    return bool(message["type"] == "websocket.close" and message.get("code") == 4401)


def test_member_is_told_about_partner_changes() -> None:
    _, alice, bob = make_couple()

    async def scenario() -> None:
        ws, ready = await open_socket({"type": "auth", "token": token(alice)})
        assert is_ready(ready)
        api = api_as(bob)
        created = await api("post", "/api/v1/lists/", {"title": "Courses"})
        assert await ws.receive_json_from(timeout=2) == {
            "type": "changed",
            "resource": "lists",
            "id": created["id"],
            "action": "upsert",
        }
        items_url = f"/api/v1/lists/{created['id']}/items/"
        item = await api("post", items_url, {"text": "Pain"})
        assert await ws.receive_json_from(timeout=2) == {
            "type": "changed",
            "resource": "list_items",
            "id": item["id"],
            "action": "upsert",
            "list_id": created["id"],
        }
        await api("post", items_url + "reorder/", {"ids": [item["id"]]})
        assert (await ws.receive_json_from(timeout=2))["action"] == "reorder"
        await api("delete", f"/api/v1/lists/{created['id']}/")
        # Its items go first (cascade), then the list itself.
        first, last = await ws.receive_json_from(timeout=2), await ws.receive_json_from(timeout=2)
        assert (first["resource"], first["action"]) == ("list_items", "delete")
        assert (last["resource"], last["action"]) == ("lists", "delete")
        assert not await sync_to_async(SharedList.objects.exists)()
        await ws.disconnect()

    run(scenario)


def test_ping_pong() -> None:
    _, alice, _ = make_couple()

    async def scenario() -> None:
        ws, _ = await open_socket({"type": "auth", "token": token(alice)})
        await ws.send_json_to({"type": "ping"})
        assert await ws.receive_json_from(timeout=2) == {"type": "pong"}
        await ws.disconnect()

    run(scenario)


def test_strangers_never_hear_about_another_couple() -> None:
    _, alice, _ = make_couple()
    _, carol, _ = make_couple()

    async def scenario() -> None:
        ws, ready = await open_socket({"type": "auth", "token": token(carol)})
        assert is_ready(ready)
        await api_as(alice)("post", "/api/v1/chores/", {"title": "Vaisselle"})
        assert await ws.receive_nothing(timeout=0.3)
        await ws.disconnect()

    run(scenario)


@pytest.mark.parametrize(
    "auth",
    [{"type": "auth", "token": "not-a-jwt"}, {"type": "auth"}, {"type": "hello"}],
)
def test_bad_auth_is_closed(auth: Any) -> None:
    make_couple()

    async def scenario() -> None:
        _, message = await open_socket(auth)
        assert closed_unauthorized(message)

    run(scenario)


def test_user_without_active_couple_is_closed() -> None:
    lonely = UserFactory()

    async def scenario() -> None:
        _, message = await open_socket({"type": "auth", "token": token(lonely)})
        assert closed_unauthorized(message)

    run(scenario)


def test_typing_reaches_the_partner_only_and_is_throttled() -> None:
    _, alice, bob = make_couple()
    _, carol, _ = make_couple()

    async def scenario() -> None:
        ws_alice, _ = await open_socket({"type": "auth", "token": token(alice)})
        ws_bob, _ = await open_socket({"type": "auth", "token": token(bob)})
        ws_carol, _ = await open_socket({"type": "auth", "token": token(carol)})
        await ws_alice.send_json_to({"type": "typing", "active": True})
        assert await ws_bob.receive_json_from(timeout=2) == {"type": "typing", "active": True}
        # Never echoed to the typist, never heard by another couple.
        assert await ws_alice.receive_nothing(timeout=0.3)
        assert await ws_carol.receive_nothing(timeout=0.3)
        # A burst within a second is dropped; "stopped" always goes through.
        await ws_alice.send_json_to({"type": "typing", "active": True})
        await ws_alice.send_json_to({"type": "typing", "active": False})
        assert await ws_bob.receive_json_from(timeout=2) == {"type": "typing", "active": False}
        assert await ws_bob.receive_nothing(timeout=0.3)
        for ws in (ws_alice, ws_bob, ws_carol):
            await ws.disconnect()

    run(scenario)
