"""Questions and games: play a pack on your own, discover both answers together.

The partner's answer to an item is NEVER returned before you answered that item
yourself. Adults-only packs appear only when both partners turned them on. A gentle day
streak counts the days you both played (allowed by the owner, see docs/DECISIONS.md).
"""

from __future__ import annotations

import random
import unicodedata
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from accounts.models import User
from core import storage
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import messages
from .catalog import CHOICE, DRAWING, KINDS, PHOTO, TAGS, TEXT, TOPICS, Item, Pack, catalogue
from .catalog import item as find_item
from .models import Answer, GamePreference, Note

DAILY_COUNT = 2
YOUR_TURN_LIMIT = 10
#: The first packs of every kind stay free once premium is enforced.
FREE_PACKS_PER_KIND = 3
MEDIA_KIND = "games"
#: Finger drawings: a 1000 x 1000 canvas, a palette of 8 colours.
DRAWING_MAX_STROKES = 300
DRAWING_MAX_POINTS = 8000
DRAWING_COLOURS = 8
STATES = ("new", "in_progress", "your_turn", "waiting", "done")
#: List filters: "unanswered" = everything I still have to play.
FILTERS = ("unanswered", "your_turn", "waiting", "done")

ArtUrl = Callable[[str], str]
Given = dict[str, dict[int, Answer]]


class GameError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# --- Who sees what -------------------------------------------------------------------


def adult_enabled(user: User) -> bool:
    return GamePreference.objects.filter(user=user, adult=True).exists()


def adult_unlocked(couple: Couple, user: User) -> bool:
    partner = couple.partner_of(user)
    return bool(partner and adult_enabled(user) and adult_enabled(partner))


def premium_enforced() -> bool:
    return bool(getattr(settings, "GAMES_PREMIUM_ENFORCED", False))


def is_premium(pack: Pack) -> bool:
    return pack.position >= FREE_PACKS_PER_KIND


def is_locked(couple: Couple, pack: Pack) -> bool:
    """Premium packs lock only once subscriptions exist (no purchase yet: all open)."""
    return premium_enforced() and is_premium(pack) and not getattr(couple, "premium", False)


def _visible(couple: Couple, user: User) -> list[Pack]:
    unlocked = adult_unlocked(couple, user)
    return [p for p in catalogue().values() if unlocked or not p.adult]


def _answers(couple: Couple) -> Given:
    by_item: Given = {}
    for answer in Answer.objects.filter(couple=couple):
        by_item.setdefault(answer.question, {})[answer.user_id] = answer
    return by_item


# --- Payloads ------------------------------------------------------------------------


def _count(pack: Pack, given: Given, user_id: int | None) -> int:
    if user_id is None:
        return 0
    return sum(1 for i in pack.items if user_id in given.get(i.id, {}))


def _state(total: int, mine: int, theirs: int) -> str:
    if mine == total and theirs == total:
        return "done"
    if mine == total:
        return "waiting"
    if theirs == total or (theirs and not mine):
        return "your_turn"
    return "in_progress" if mine else "new"


def _matches(pack: Pack, mine: Answer, theirs: Answer) -> bool | None:
    if pack.mode != CHOICE or mine.skipped or theirs.skipped:
        return None
    if pack.kind == "most_likely":
        # "Me" from one side and "You" from the other point at the same person.
        return mine.choice != theirs.choice
    return mine.choice == theirs.choice


def similarity(pack: Pack, given: Given, user_id: int, partner_id: int) -> int | None:
    """Share of the items where you both picked the same thing (choice games only)."""
    results = [
        _matches(pack, pair[user_id], pair[partner_id])
        for i in pack.items
        if (pair := given.get(i.id, {})) and user_id in pair and partner_id in pair
    ]
    compared = [r for r in results if r is not None]
    return round(100 * sum(compared) / len(compared)) if compared else None


def pack_summary(
    pack: Pack, couple: Couple, user: User, partner: User | None, given: Given, art: ArtUrl
) -> dict[str, Any]:
    total = len(pack.items)
    mine = _count(pack, given, user.pk)
    theirs = _count(pack, given, partner.pk if partner else None)
    state = _state(total, mine, theirs)
    lang = user.language
    return {
        "id": pack.id,
        "kind": pack.kind,
        "kind_name": KINDS[pack.kind][1 if lang == "en" else 0],
        "title": pack.title(lang),
        "art": art(pack.art),
        "topics": list(pack.topics),
        "tags": [{"slug": t, "name": TAGS[t][1 if lang == "en" else 0]} for t in pack.tags],
        "adult": pack.adult,
        "premium": is_premium(pack),
        "locked": is_locked(couple, pack),
        "position": pack.position,
        "total": total,
        "mine": mine,
        "theirs": theirs,
        "state": state,
        "similarity": (
            similarity(pack, given, user.pk, partner.pk) if partner and state == "done" else None
        ),
    }


def _given_payload(answer: Answer) -> dict[str, Any]:
    return {
        "choice": answer.choice,
        "text": answer.text,
        "drawing": answer.drawing or [],
        "photo_url": storage.signed_url(answer.media_key) if answer.media_key else None,
        "skipped": answer.skipped,
    }


def _item_payload(
    pack: Pack, entry: Item, user: User, partner: User | None, given: Given, art: ArtUrl
) -> dict[str, Any]:
    pair = given.get(entry.id, {})
    mine = pair.get(user.pk)
    theirs = pair.get(partner.pk) if partner else None
    lang = user.language
    return {
        "id": entry.id,
        "text": entry.text(lang),
        "options": [
            {"name": o.label(lang), "art": art(o.art) if o.art else None} for o in entry.options
        ],
        "mine": _given_payload(mine) if mine else None,
        "partner_answered": theirs is not None,
        # Never before I answered this item myself.
        "theirs": _given_payload(theirs) if mine and theirs else None,
        "match": _matches(pack, mine, theirs) if mine and theirs else None,
    }


def pack_detail(couple: Couple, user: User, pack_id: str, art: ArtUrl) -> dict[str, Any]:
    pack = catalogue().get(pack_id)
    if pack is None or (pack.adult and not adult_unlocked(couple, user)):
        raise GameError("unknown_pack")
    partner = couple.partner_of(user)
    given = _answers(couple)
    return {
        **pack_summary(pack, couple, user, partner, given, art),
        "mode": pack.mode,
        "items": [_item_payload(pack, i, user, partner, given, art) for i in pack.items],
    }


def _fold(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def packs(
    couple: Couple,
    user: User,
    art: ArtUrl,
    *,
    kind: str | None = None,
    topic: str | None = None,
    state: str | None = None,
    query: str = "",
) -> dict[str, Any]:
    partner = couple.partner_of(user)
    given = _answers(couple)
    unlocked = adult_unlocked(couple, user)
    needle = _fold(query.strip())

    def wanted(pack: Pack) -> bool:
        return (
            (kind is None or pack.kind == kind)
            and (topic is None or topic in pack.topics)
            and (not needle or needle in _fold(pack.title_fr) or needle in _fold(pack.title_en))
        )

    candidates = [p for p in catalogue().values() if wanted(p)]
    summaries = [
        pack_summary(p, couple, user, partner, given, art)
        for p in candidates
        if unlocked or not p.adult
    ]
    if state == "unanswered":
        summaries = [s for s in summaries if s["state"] in {"new", "in_progress", "your_turn"}]
    elif state is not None:
        summaries = [s for s in summaries if s["state"] == state]
    return {
        "packs": summaries,
        "adult_hidden": 0 if unlocked else sum(1 for p in candidates if p.adult),
    }


# --- Home ----------------------------------------------------------------------------


def _daily(couple: Couple, user: User, day: date, given: Given) -> list[Pack]:
    """The same two packs for both partners all day, among those not finished yet."""
    partner = couple.partner_of(user)
    ids = [user.pk, partner.pk if partner else -1]

    def finished(pack: Pack) -> bool:
        return all(len(given.get(i.id, {})) == 2 for i in pack.items)

    playable = [p for p in _visible(couple, user) if not p.adult and not is_locked(couple, p)]
    # Packs played today stay in today's pair so the results remain on the home.
    today = [
        p
        for p in playable
        if any(
            timezone.localdate(a.created_at) == day
            for i in p.items
            for uid, a in given.get(i.id, {}).items()
            if uid in ids
        )
    ]
    pool = [p for p in playable if not finished(p)]
    rng = random.Random(f"{couple.pk}:{day.isoformat()}")  # noqa: S311 - not security
    picked = rng.sample(pool, min(DAILY_COUNT, len(pool)))
    return list(dict.fromkeys([*today, *picked]))[:DAILY_COUNT]


def streak(couple: Couple, user: User, today: date) -> dict[str, Any]:
    """Days in a row on which BOTH partners answered at least one item.

    Today not played yet does not break the streak: it still counts up to yesterday.
    """
    partner = couple.partner_of(user)
    days: dict[int, set[date]] = {}
    for user_id, created_at in Answer.objects.filter(couple=couple).values_list(
        "user_id", "created_at"
    ):
        days.setdefault(user_id, set()).add(timezone.localdate(created_at))
    both = days.get(user.pk, set()) & days.get(partner.pk, set()) if partner else set()
    today_done = today in both
    cursor = today if today_done else today - timedelta(days=1)
    count = 0
    while cursor in both:
        count += 1
        cursor -= timedelta(days=1)
    return {"count": count, "today_done": today_done}


def home(couple: Couple, user: User, art: ArtUrl) -> dict[str, Any]:
    partner = couple.partner_of(user)
    given = _answers(couple)
    visible = _visible(couple, user)
    lang = 1 if user.language == "en" else 0
    summaries = {p.id: pack_summary(p, couple, user, partner, given, art) for p in visible}
    states = [s["state"] for s in summaries.values()]
    your_turn = [s for s in summaries.values() if s["state"] == "your_turn"]
    unlocked = adult_unlocked(couple, user)

    topics = []
    for slug, names in TOPICS.items():
        locked = names[2] and not unlocked
        # An 18+ pack may also sit in a general topic: it only counts there once opened.
        of_topic = [
            p for p in catalogue().values() if slug in p.topics and (locked or p.id in summaries)
        ]
        if not of_topic:
            continue
        done = 0 if locked else sum(1 for p in of_topic if summaries[p.id]["state"] == "done")
        topics.append(
            {
                "slug": slug,
                "name": names[lang],
                "adult": names[2],
                "locked": locked,
                "total": len(of_topic),
                "done": done,
                "percent": round(100 * done / len(of_topic)),
            }
        )
    kinds = [
        {
            "slug": slug,
            "name": names[lang],
            "total": sum(1 for p in visible if p.kind == slug),
        }
        for slug, names in KINDS.items()
    ]
    return {
        "daily": [summaries[p.id] for p in _daily(couple, user, timezone.localdate(), given)],
        "your_turn": your_turn[:YOUR_TURN_LIMIT],
        "your_turn_count": len(your_turn),
        "waiting_count": states.count("waiting"),
        "done_count": states.count("done"),
        "topics": topics,
        "kinds": [k for k in kinds if k["total"]],
        "adult": {
            "mine": adult_enabled(user),
            "partner": bool(partner and adult_enabled(partner)),
        },
        "stats": stats(couple, states.count("done"), len(visible)),
        "streak": streak(couple, user, timezone.localdate()),
    }


def stats(couple: Couple, done: int, total: int) -> dict[str, Any]:
    from memories.models import Memory
    from messaging.models import Message
    from organization.models import Event

    days = (timezone.localdate() - couple.start_date).days if couple.start_date else None
    return {
        "days_together": days,
        "answered_percent": round(100 * done / total) if total else 0,
        "answered": done,
        "memories": Memory.objects.filter(couple=couple).count(),
        "events": Event.objects.filter(couple=couple).count(),
        "messages": Message.objects.filter(couple=couple).count(),
        "notes": Note.objects.filter(couple=couple).count(),
    }


# --- Answering -----------------------------------------------------------------------


def request_upload(couple: Couple, content_type: str) -> storage.UploadTicket:
    """A presigned upload for a photo answer."""
    try:
        return storage.presign_image_upload(
            owner="couples", owner_id=couple.pk, kind=MEDIA_KIND, content_type=content_type
        )
    except storage.StorageError as exc:
        raise GameError(exc.code) from exc


def clean_drawing(strokes: Any) -> list[dict[str, Any]]:
    """Keeps a drawing small and well-formed: bounded strokes, points, colours, widths."""
    if not isinstance(strokes, list) or not strokes or len(strokes) > DRAWING_MAX_STROKES:
        raise GameError("invalid_drawing")
    cleaned: list[dict[str, Any]] = []
    points = 0
    for stroke in strokes:
        if not isinstance(stroke, dict):
            raise GameError("invalid_drawing")
        colour, width, coords = stroke.get("c"), stroke.get("w"), stroke.get("p")
        if (
            not isinstance(colour, int)
            or not 0 <= colour < DRAWING_COLOURS
            or not isinstance(width, int)
            or not 1 <= width <= 40
            or not isinstance(coords, list)
            or len(coords) < 2
            or len(coords) % 2
            or not all(isinstance(v, int) and 0 <= v <= 1000 for v in coords)
        ):
            raise GameError("invalid_drawing")
        points += len(coords) // 2
        cleaned.append({"c": colour, "w": width, "p": coords})
    if points > DRAWING_MAX_POINTS:
        raise GameError("invalid_drawing")
    return cleaned


def _check_photo(couple: Couple, key: str) -> None:
    if not storage.key_belongs_to(key, owner="couples", owner_id=couple.pk, kind=MEDIA_KIND):
        raise GameError("invalid_key")
    if key.rsplit(".", 1)[-1] not in storage.ALLOWED_IMAGE_TYPES.values():
        raise GameError("invalid_key")
    size = storage.uploaded_size(key)
    if size is None or size > storage.MAX_IMAGE_BYTES:
        raise GameError("upload_missing")


def answer(
    couple: Couple,
    user: User,
    item_id: str,
    art: ArtUrl,
    *,
    choice: int | None = None,
    text: str = "",
    drawing: Any = None,
    media_key: str = "",
    skipped: bool = False,
) -> dict[str, Any]:
    found = find_item(item_id)
    if found is None:
        raise GameError("unknown_question")
    pack, entry = found
    if pack.adult and not adult_unlocked(couple, user):
        raise GameError("locked")
    if is_locked(couple, pack):
        raise GameError("premium")
    values: dict[str, Any] = {"skipped": skipped}
    if not skipped:
        if pack.mode == CHOICE:
            if choice is None or not 0 <= choice < len(entry.options):
                raise GameError("invalid_choice")
            values["choice"] = choice
        elif pack.mode == TEXT:
            if not text.strip():
                raise GameError("text_required")
            values["text"] = text.strip()
        elif pack.mode == DRAWING:
            values["drawing"] = clean_drawing(drawing)
        elif pack.mode == PHOTO:
            _check_photo(couple, media_key)
            values["media_key"] = media_key
    _, created = Answer.objects.get_or_create(
        couple=couple, user=user, question=item_id, defaults=values
    )
    if not created:
        raise GameError("already_answered")
    notify_changed(couple.pk, "games", 0, "answered")
    partner = couple.partner_of(user)
    given = _answers(couple)
    if partner is not None and _count(pack, given, user.pk) == len(pack.items):
        _tell_partner(pack, user, partner, both=_count(pack, given, partner.pk) == len(pack.items))
    return _item_payload(pack, entry, user, partner, given, art)


def _tell_partner(pack: Pack, user: User, partner: User, *, both: bool) -> None:
    """One push when a whole pack is finished, not one per item."""
    discreet = preference_for(partner).discreet
    key = "revealed" if both else "your_turn"
    notify(
        partner,
        Kind.DAILY_QUESTION,
        messages.text(
            partner.language,
            "discreet_title" if discreet else f"{key}_title",
            name=user.display_name,
            pack=pack.title(partner.language),
        ),
        messages.text(
            partner.language,
            "discreet_body" if discreet else f"{key}_body",
            pack=pack.title(partner.language),
        ),
        {"screen": "games", "pack": pack.id},
    )


def set_adult(couple: Couple, user: User, enabled: bool) -> None:
    GamePreference.objects.update_or_create(user=user, defaults={"adult": enabled})
    notify_changed(couple.pk, "games", 0, "preferences")
