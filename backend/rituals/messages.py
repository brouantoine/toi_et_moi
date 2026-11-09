"""Notification texts for the morning mood, in the recipient's language (fr/en).

The advice tells the partner *how* to speak, briefly: never a speech.
"""

from __future__ import annotations

NB = " "

TEXTS: dict[str, dict[str, object]] = {
    "fr": {
        "invite_title": "Bonjour {name}",
        "invite_body": f"Comment tu te sens ce matin{NB}?",
        "mood": {
            "joyful": "Grande joie",
            "happy": "Bonne humeur",
            "upset": "Contrariété",
            "angry": "Énervement",
        },
        "need": {
            "space": "besoin d’espace",
            "hug": "besoin d’un câlin",
            "help": "besoin d’aide",
            "listen": "besoin d’écoute",
        },
        "advice_mood": {
            "joyful": "Partage ce moment avec un petit mot.",
            "happy": "Un mot doux suffit pour bien commencer la journée.",
            "upset": f"Une question simple{NB}: «{NB}Je peux faire quelque chose{NB}?{NB}»",
            "angry": "Un mot court suffit, pas de discours.",
        },
        "advice_need": {
            "space": "Laisse un peu d’espace, un mot court suffit.",
            "hug": "Un câlin dès que possible.",
            "help": "Propose une aide concrète.",
            "listen": "Prends un moment pour écouter, sans conseils.",
        },
        "partner_title": "Météo de {name}",
        "partner_line": "{mood} ce matin",
        "discreet_title": "Bolingo",
        "discreet_body": "{name} a partagé sa météo du matin.",
        "reply_title": "{name}",
        "reply": {
            "here": "Je suis là.",
            "courage": "Courage.",
            "tonight": f"On en parle ce soir{NB}?",
            "thinking": "Je pense à toi.",
        },
        "discreet_reply": "{name} t’a répondu.",
    },
    "en": {
        "invite_title": "Good morning {name}",
        "invite_body": "How do you feel this morning?",
        "mood": {"joyful": "Great joy", "happy": "Good mood", "upset": "Upset", "angry": "Anger"},
        "need": {
            "space": "needs space",
            "hug": "needs a hug",
            "help": "needs help",
            "listen": "needs listening",
        },
        "advice_mood": {
            "joyful": "Share the moment with a little word.",
            "happy": "A kind word is enough to start the day well.",
            "upset": "A simple question: “Can I do something?”",
            "angry": "A short word is enough, no speech.",
        },
        "advice_need": {
            "space": "Give some space, a short word is enough.",
            "hug": "A hug as soon as you can.",
            "help": "Offer concrete help.",
            "listen": "Take a moment to listen, without advice.",
        },
        "partner_title": "{name}’s weather",
        "partner_line": "{mood} this morning",
        "discreet_title": "Bolingo",
        "discreet_body": "{name} shared their morning weather.",
        "reply_title": "{name}",
        "reply": {
            "here": "I’m here.",
            "courage": "Hang in there.",
            "tonight": "Shall we talk tonight?",
            "thinking": "Thinking of you.",
        },
        "discreet_reply": "{name} replied to you.",
    },
}


def texts(language: str) -> dict[str, object]:
    return TEXTS.get(language, TEXTS["fr"])


def _get(table: dict[str, object], key: str) -> dict[str, str]:
    value = table[key]
    assert isinstance(value, dict)  # noqa: S101 - static table
    return value


def invitation(language: str, name: str) -> tuple[str, str]:
    t = texts(language)
    return str(t["invite_title"]).format(name=name), str(t["invite_body"])


def partner_mood(language: str, name: str, mood: str, need: str, discreet: bool) -> tuple[str, str]:
    """(title, body) for the partner: what, and how to speak — or only *that*, if discreet."""
    t = texts(language)
    if discreet:
        return str(t["discreet_title"]), str(t["discreet_body"]).format(name=name)
    line = str(t["partner_line"]).format(mood=_get(t, "mood")[mood])
    if need and need in _get(t, "need"):
        line = f"{line} · {_get(t, 'need')[need]}"
    advice = _get(t, "advice_need").get(need) or _get(t, "advice_mood")[mood]
    return str(t["partner_title"]).format(name=name), f"{line}. {advice}"


def reply(language: str, name: str, code: str, discreet: bool) -> tuple[str, str]:
    t = texts(language)
    if discreet:
        return str(t["discreet_title"]), str(t["discreet_reply"]).format(name=name)
    return str(t["reply_title"]).format(name=name), _get(t, "reply")[code]
