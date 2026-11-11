"""Push texts for calls (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "audio": "T’appelle",
        "video": "Appel vidéo",
        "discreet": "Appel entrant",
    },
    "en": {
        "audio": "Calling you",
        "video": "Video call",
        "discreet": "Incoming call",
    },
}


def text(language: str, key: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key]
