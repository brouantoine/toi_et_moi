from typing import Any

from celery import shared_task

from core.emails import send_email


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_email_task(to: str, name: str, language: str, context: dict[str, Any]) -> None:
    send_email(to, name, language, context)
