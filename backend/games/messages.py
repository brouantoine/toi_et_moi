"""Notification texts for questions and games (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "your_turn_title": "{name} a joué à « {pack} »",
        "your_turn_body": "À ton tour : joue pour découvrir ses réponses.",
        "revealed_title": "{name} a terminé « {pack} »",
        "revealed_body": "Vos réponses sont prêtes : découvrez vos résultats.",
        "discreet_title": "Bolingo",
        "discreet_body": "Du nouveau dans vos jeux.",
    },
    "en": {
        "your_turn_title": "{name} played “{pack}”",
        "your_turn_body": "Your turn: play to discover their answers.",
        "revealed_title": "{name} finished “{pack}”",
        "revealed_body": "Your answers are ready: see your results.",
        "discreet_title": "Bolingo",
        "discreet_body": "Something new in your games.",
    },
}


def text(language: str, key: str, **values: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key].format(**values)
