"""Transactional emails rendered from per-language text templates.

Templates live in templates/emails/<name>.<lang>.txt. The first line is the subject.
No private content is ever put in an email.
"""

from typing import Any

from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string

SUPPORTED = ("fr", "en")


def render_email(name: str, language: str, context: dict[str, Any]) -> tuple[str, str]:
    lang = language if language in SUPPORTED else "fr"
    full = {"brand": settings.BRAND_NAME, **context}
    rendered = render_to_string(f"emails/{name}.{lang}.txt", full).strip()
    subject, _, body = rendered.partition("\n")
    return subject.strip(), body.strip() + "\n"


def send_email(to: str, name: str, language: str, context: dict[str, Any]) -> None:
    subject, body = render_email(name, language, context)
    EmailMessage(subject=subject, body=body, to=[to]).send()
