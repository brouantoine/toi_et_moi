"""Partner notification texts for messages (recipient's language, discreet aware)."""

from __future__ import annotations

TEXTS = {
    "fr": {
        "voice": "{name} t’a envoyé une note vocale.",
        "photo": "{name} t’a envoyé une photo.",
        "discreet": "{name} t’a écrit.",
    },
    "en": {
        "voice": "{name} sent you a voice note.",
        "photo": "{name} sent you a photo.",
        "discreet": "{name} wrote to you.",
    },
}
PREVIEW = 120


def notification(language: str, name: str, kind: str, text: str, discreet: bool) -> tuple[str, str]:
    t = TEXTS.get(language, TEXTS["fr"])
    if discreet:
        return "Nous Deux", t["discreet"].format(name=name)
    if kind == "text":
        body = text if len(text) <= PREVIEW else f"{text[: PREVIEW - 1]}…"
        return name, body
    return name, t[kind].format(name=name)
