"""Morning mood: share, answer, invite each morning, forget after two days."""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from couples.models import Couple, CoupleStatus
from notifications.models import Kind
from notifications.services import local_now, notify, preference_for

from . import messages
from .models import MoodReply, MorningMood

MAX_REPLIES_PER_DAY = 3
INVITE_WINDOW = dt.timedelta(minutes=15)
CATEGORY_MOOD = "morning_mood"
CATEGORY_PARTNER = "partner_mood"


def today_for(user: User, now: dt.datetime | None = None) -> dt.date:
    return local_now(user, now).date()


def mood_of(user: User, now: dt.datetime | None = None) -> MorningMood | None:
    return MorningMood.objects.filter(user=user, day=today_for(user, now)).first()


@transaction.atomic
def share_mood(user: User, couple: Couple, mood: str, need: str) -> MorningMood:
    """Records (or changes) today's mood and tells the partner when it changes."""
    day = today_for(user)
    previous = MorningMood.objects.select_for_update().filter(user=user, day=day).first()
    record, _ = MorningMood.objects.update_or_create(
        user=user, day=day, defaults={"couple": couple, "mood": mood, "need": need}
    )
    if previous is None or (previous.mood, previous.need) != (mood, need):
        partner = couple.partner_of(user)
        if partner is not None:
            transaction.on_commit(lambda: _tell_partner(partner, user, record))
    return record


def _tell_partner(partner: User, author: User, record: MorningMood) -> None:
    pref = preference_for(partner)
    title, body = messages.partner_mood(
        partner.language, author.display_name, record.mood, record.need, pref.discreet
    )
    notify(partner, Kind.PARTNER_MOOD, title, body, {"screen": "today"}, category=CATEGORY_PARTNER)


def reply_to_partner(user: User, couple: Couple, code: str) -> MoodReply | None:
    """One-tap answer to the partner's mood of today. None when there is nothing to answer."""
    partner = couple.partner_of(user)
    if partner is None:
        return None
    target = mood_of(partner)
    if target is None:
        return None
    if MoodReply.objects.filter(mood=target, author=user).count() >= MAX_REPLIES_PER_DAY:
        raise PermissionError("too_many_replies")
    answer = MoodReply.objects.create(mood=target, author=user, reply=code)
    pref = preference_for(partner)
    title, body = messages.reply(partner.language, user.display_name, code, pref.discreet)
    notify(partner, Kind.PARTNER_MOOD, title, body, {"screen": "today"})
    return answer


def send_morning_invitations(now: dt.datetime | None = None) -> int:
    """Invites people whose morning time has come (once a day, if not answered yet)."""
    now = now or timezone.now()
    sent = 0
    # Everyone in an active couple, with default preferences when never customised.
    people = User.objects.filter(memberships__couple__status=CoupleStatus.ACTIVE).distinct()
    for user in people:
        pref = preference_for(user)
        if not pref.morning_mood:
            continue
        local = local_now(user, now)
        start = dt.datetime.combine(local.date(), pref.morning_time, tzinfo=local.tzinfo)
        if not (start <= local < start + INVITE_WINDOW):
            continue
        if pref.last_morning_invite == local.date():
            continue
        if MorningMood.objects.filter(user=user, day=local.date()).exists():
            continue
        title, body = messages.invitation(user.language, user.display_name)
        pref.last_morning_invite = local.date()
        pref.save(update_fields=["last_morning_invite"])
        if notify(
            user, Kind.MORNING_MOOD, title, body, {"screen": "today"}, category=CATEGORY_MOOD
        ):
            sent += 1
    return sent


def forget_old_moods(now: dt.datetime | None = None) -> int:
    """No history: moods older than two days are deleted (with their replies)."""
    cutoff = (now or timezone.now()).date() - dt.timedelta(days=2)
    deleted, _ = MorningMood.objects.filter(day__lt=cutoff).delete()
    return deleted
