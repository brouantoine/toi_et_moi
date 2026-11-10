"""Texts the coach feature shows or pushes outside the model's own replies (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "notice": "Le coach n’a pas pu répondre cette fois. Réessayez dans un instant.",
        "replied_title": "Le coach a répondu",
        "discreet_title": "Bolingo",
    },
    "en": {
        "notice": "The coach could not answer this time. Please try again in a moment.",
        "replied_title": "The coach replied",
        "discreet_title": "Bolingo",
    },
}


def text(language: str, key: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key]
