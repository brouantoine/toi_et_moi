"""Games catalogue: packs of questions (fr/en), kept in versioned JSON files.

A PACK is a themed set of 6 to 12 items played the same way (its KIND), filed under one
or more TOPICS and flagged with TAGS (18+, kids, money...). Each partner plays the pack
on their own, then both discover the answers side by side.

Content lives in ``games/content/<kind>.json`` (one file per kind). Ids are stable
(``"vie-quotidienne.3"``): answers reference them, so a pack slug never changes and items
are only ever appended. Illustrations are Fluent Emoji 3D images (Microsoft, MIT) served
as static files, see ``art_path``.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import cache
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent / "content"

#: How each kind is answered.
CHOICE, TEXT, DRAWING, PHOTO = "choice", "text", "drawing", "photo"

#: slug -> (fr, en, answer mode). Order is the display order.
KINDS: dict[str, tuple[str, str, str]] = {
    "most_likely": ("Qui est le plus ?", "Who is most likely?", CHOICE),
    "draw": ("Dessiner", "Draw", DRAWING),
    "this_or_that": ("Ça ou ça ?", "This or that?", CHOICE),
    "never": ("Je n’ai jamais", "Never have I ever", CHOICE),
    "rather": ("Que préfères-tu ?", "Would you rather?", CHOICE),
    "conversation": ("Conversation", "Conversation", TEXT),
    "agree": ("D’accord ou pas ?", "Agree or not?", CHOICE),
    "photo": ("Répondre avec une photo", "Answer with a photo", PHOTO),
}

#: Answers every item of these kinds shares (index = stored choice).
FIXED_OPTIONS: dict[str, dict[str, tuple[str, str]]] = {
    "never": {"fr": ("Je n’ai jamais !", "J’ai déjà !"), "en": ("I never have!", "I have!")},
    "agree": {"fr": ("D’accord", "Pas d’accord"), "en": ("Agree", "Disagree")},
    # Stored from the answerer's point of view: 0 = me, 1 = my partner.
    "most_likely": {"fr": ("Moi", "Toi"), "en": ("Me", "You")},
}

#: slug -> (fr, en, adults only). Order is the display order.
TOPICS: dict[str, tuple[str, str, bool]] = {
    "relationship": ("Amour et relation", "Love and relationship", False),
    "deep": ("Conversations profondes", "Deep talks", False),
    "knowyou": ("Apprends à te connaître", "Getting to know you", False),
    "before": ("Parler avant de…", "Talk before…", False),
    "us": ("Notre histoire", "Our story", False),
    "fun": ("Pour rire", "Just for fun", False),
    "food": ("Cuisine et boissons", "Food and drinks", False),
    "travel": ("Voyage", "Travel", False),
    "family": ("Famille et maison", "Family and home", False),
    "hobbies": ("Loisirs et passions", "Hobbies and passions", False),
    "lifestyle": ("Mode de vie", "Lifestyle", False),
    "money": ("Argent", "Money", False),
    "work": ("Travail et études", "Work and studies", False),
    "values": ("Valeurs", "Values", False),
    "future": ("Avenir et engagement", "Future and commitment", False),
    "intimacy": ("Sexe et amour", "Sex and love", True),
}

#: Badges shown on a pack so the couple knows what it touches. slug -> (fr, en)
TAGS: dict[str, tuple[str, str]] = {
    "adult": ("18+", "18+"),
    "kids": ("Enfants", "Kids"),
    "money": ("Argent", "Money"),
    "wedding": ("Mariage", "Wedding"),
    "ex": ("Ex", "Ex"),
}


def art_slug(name: str) -> str:
    """Fluent emoji name -> file name: "Face with tears of joy" -> "face-with-tears-of-joy"."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def art_path(name: str) -> str:
    """Static path of an illustration (see games/static/games/art)."""
    return f"games/art/{art_slug(name)}.webp"


@dataclass(frozen=True, slots=True)
class Option:
    fr: str
    en: str
    art: str = ""

    def label(self, language: str) -> str:
        return self.en if language == "en" else self.fr


@dataclass(frozen=True, slots=True)
class Item:
    id: str
    fr: str
    en: str
    options: tuple[Option, ...]

    def text(self, language: str) -> str:
        return self.en if language == "en" else self.fr


@dataclass(frozen=True, slots=True)
class Pack:
    id: str
    kind: str
    title_fr: str
    title_en: str
    topics: tuple[str, ...]
    tags: tuple[str, ...]
    art: str
    items: tuple[Item, ...]
    position: int  # rank inside its kind, used for the free tier and the colours

    @property
    def adult(self) -> bool:
        return "adult" in self.tags

    @property
    def mode(self) -> str:
        return KINDS[self.kind][2]

    def title(self, language: str) -> str:
        return self.title_en if language == "en" else self.title_fr


def _options(kind: str, raw: dict[str, str]) -> tuple[Option, ...]:
    fixed = FIXED_OPTIONS.get(kind)
    if fixed is not None:
        return tuple(Option(fr, en) for fr, en in zip(fixed["fr"], fixed["en"], strict=True))
    if kind in {"rather", "this_or_that"}:
        return (
            Option(raw["a_fr"], raw["a_en"], raw["a_art"]),
            Option(raw["b_fr"], raw["b_en"], raw["b_art"]),
        )
    return ()


def load(directory: Path = CONTENT_DIR) -> dict[str, Pack]:
    packs: dict[str, Pack] = {}
    for kind in KINDS:
        path = directory / f"{kind}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for position, raw in enumerate(data["packs"]):
            pack_id = raw["slug"]
            if pack_id in packs:
                raise ValueError(f"duplicate pack id {pack_id}")
            items = tuple(
                Item(
                    f"{pack_id}.{index}",
                    item.get("fr", ""),
                    item.get("en", ""),
                    _options(kind, item),
                )
                for index, item in enumerate(raw["items"], start=1)
            )
            packs[pack_id] = Pack(
                id=pack_id,
                kind=kind,
                title_fr=raw["title_fr"],
                title_en=raw["title_en"],
                topics=tuple(raw["topics"]),
                tags=tuple(raw.get("tags", ())),
                art=raw["art"],
                items=items,
                position=position,
            )
    return packs


@cache
def catalogue() -> dict[str, Pack]:
    return load()


def pack_of(item_id: str) -> Pack | None:
    pack_id, _, _ = item_id.rpartition(".")
    return catalogue().get(pack_id)


def item(item_id: str) -> tuple[Pack, Item] | None:
    pack = pack_of(item_id)
    if pack is None:
        return None
    found = next((i for i in pack.items if i.id == item_id), None)
    return (pack, found) if found else None
