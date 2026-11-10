"""Notification texts for questions and games (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "your_turn_title": "{name} a répondu",
        "your_turn_body": "À ton tour : réponds pour découvrir sa réponse.",
        "revealed_title": "{name} a répondu aussi",
        "revealed_body": "Vos deux réponses sont prêtes à être découvertes.",
        "discreet_title": "Bolingo",
        "discreet_body": "Du nouveau dans vos jeux.",
    },
    "en": {
        "your_turn_title": "{name} answered",
        "your_turn_body": "Your turn: answer to discover theirs.",
        "revealed_title": "{name} answered too",
        "revealed_body": "Both your answers are ready to discover.",
        "discreet_title": "Bolingo",
        "discreet_body": "Something new in your games.",
    },
}


def text(language: str, key: str, **values: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key].format(**values)
