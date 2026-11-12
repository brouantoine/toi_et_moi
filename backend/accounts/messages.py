"""Push texts about accounts (fr/en)."""

from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "partner_deleted_title": "Votre espace commun a été fermé",
        "partner_deleted_body": "{name} a supprimé son compte. Tu peux créer un nouvel espace.",
    },
    "en": {
        "partner_deleted_title": "Your shared space was closed",
        "partner_deleted_body": "{name} deleted their account. You can start a new space.",
    },
}


def text(language: str, key: str, **values: str) -> str:
    return TEXTS.get(language, TEXTS["fr"])[key].format(**values)
