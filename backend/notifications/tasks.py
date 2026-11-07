from typing import Any
from urllib.error import URLError

from celery import shared_task

from .services import build_messages, forget_gone_tokens, post_to_expo


@shared_task(autoretry_for=(URLError, TimeoutError), retry_backoff=True, max_retries=3)
def send_push(
    tokens: list[str], title: str, body: str, data: dict[str, Any], category: str | None = None
) -> int:
    """Sends one notification to several phones. Returns how many tokens were forgotten."""
    tickets = post_to_expo(build_messages(tokens, title, body, data, category))
    return forget_gone_tokens(tokens, tickets)
