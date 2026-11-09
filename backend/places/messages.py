"""Notification texts for proximity and the continuous-sharing reminder (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "near_title": "{name} est près de toi",
        "near_body": "Vous êtes à moins d’un kilomètre l’un de l’autre.",
        "near_discreet_title": "Bolingo",
        "near_discreet_body": "Une bonne nouvelle t’attend.",
        "reminder_title": "Partage de position en continu",
        "reminder_body": "Tu partages ta position avec {name}, même app fermée. "
        "Tu peux l’arrêter à tout moment dans Distance et carte.",
    },
    "en": {
        "near_title": "{name} is near you",
        "near_body": "You are less than a kilometre apart.",
        "near_discreet_title": "Bolingo",
        "near_discreet_body": "Some good news is waiting for you.",
        "reminder_title": "Continuous location sharing",
        "reminder_body": "You share your location with {name}, even when the app is closed. "
        "You can stop at any time in Distance and map.",
    },
}


def text(language: str, key: str, **values: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key].format(**values)
