"""The couple's private thread: send (text, photo, voice), delete one's own."""

from __future__ import annotations

from django.db import transaction

from accounts.models import User
from core import storage
from core.realtime import notify_changed
from couples.models import Couple
from notifications.models import Kind
from notifications.services import notify, preference_for

from . import messages
from .models import Message, MessageKind

MEDIA_KIND = "messages"


class MessageRuleError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def request_upload(couple: Couple, content_type: str) -> storage.UploadTicket:
    """A presigned upload for a photo or a voice note of the thread."""
    if content_type in storage.ALLOWED_AUDIO_TYPES:
        allowed, max_bytes = storage.ALLOWED_AUDIO_TYPES, storage.MAX_AUDIO_BYTES
    else:
        allowed, max_bytes = storage.ALLOWED_IMAGE_TYPES, storage.MAX_IMAGE_BYTES
    try:
        return storage.presign_upload(
            owner="couples",
            owner_id=couple.pk,
            kind=MEDIA_KIND,
            content_type=content_type,
            allowed=allowed,
            max_bytes=max_bytes,
        )
    except storage.StorageError as exc:
        raise MessageRuleError(exc.code) from exc


def _check_media(couple: Couple, kind: str, key: str) -> None:
    if not storage.key_belongs_to(key, owner="couples", owner_id=couple.pk, kind=MEDIA_KIND):
        raise MessageRuleError("invalid_key")
    extension = key.rsplit(".", 1)[-1]
    expected = (
        storage.ALLOWED_AUDIO_TYPES if kind == MessageKind.VOICE else storage.ALLOWED_IMAGE_TYPES
    )
    if extension not in expected.values():
        raise MessageRuleError("invalid_key")
    if Message.objects.filter(media_key=key).exists():
        raise MessageRuleError("invalid_key")
    if storage.uploaded_size(key) is None:
        raise MessageRuleError("upload_missing")


@transaction.atomic
def send(couple: Couple, author: User, data: dict[str, object]) -> Message:
    kind = str(data["kind"])
    text = str(data.get("text") or "").strip()
    key = str(data.get("media_key") or "")
    if kind == MessageKind.TEXT:
        if not text:
            raise MessageRuleError("empty")
        key = ""
    else:
        _check_media(couple, kind, key)
    message = Message.objects.create(
        couple=couple,
        author=author,
        kind=kind,
        text=text if kind != MessageKind.VOICE else "",
        media_key=key,
        duration_ms=data.get("duration_ms") if kind == MessageKind.VOICE else None,  # type: ignore[misc]
        width=data.get("width") if kind == MessageKind.PHOTO else None,
        height=data.get("height") if kind == MessageKind.PHOTO else None,
    )
    partner = couple.partner_of(author)
    if partner is not None:
        transaction.on_commit(lambda: _tell_partner(partner, author, message))
    return message


def _tell_partner(partner: User, author: User, message: Message) -> None:
    pref = preference_for(partner)
    title, body = messages.notification(
        partner.language, author.display_name, message.kind, message.text, pref.discreet
    )
    notify(partner, Kind.MESSAGES, title, body, {"screen": "messages"})


def delete(message: Message) -> None:
    key = message.media_key
    message.delete()
    if key:
        transaction.on_commit(lambda: storage.delete_file(key))


def mark_read(couple: Couple, reader: User) -> int:
    """Marks every message the partner sent to `reader` as read. Returns how many."""
    from django.utils import timezone

    count = (
        Message.objects.filter(couple=couple, read_at__isnull=True)
        .exclude(author=reader)
        .update(read_at=timezone.now())
    )
    if count:
        notify_changed(couple.pk, "messages", 0, "read")
    return count
