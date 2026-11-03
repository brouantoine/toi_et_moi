"""Single-image fields (avatar, couple photo) set from a confirmed direct upload."""

from __future__ import annotations

from django.db import models, transaction

from . import storage


class UploadRuleError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def request_upload(
    *, owner: str, owner_id: int, kind: str, content_type: str
) -> storage.UploadTicket:
    try:
        return storage.presign_image_upload(
            owner=owner, owner_id=owner_id, kind=kind, content_type=content_type
        )
    except storage.StorageError as exc:
        raise UploadRuleError(exc.code) from exc


@transaction.atomic
def set_image(
    instance: models.Model, field: str, key: str | None, *, owner: str, owner_id: int, kind: str
) -> None:
    """Points `field` at an uploaded key (or clears it); the previous file is really deleted."""
    if key is not None:
        if not storage.key_belongs_to(key, owner=owner, owner_id=owner_id, kind=kind):
            raise UploadRuleError("invalid_key")
        if storage.uploaded_size(key) is None:
            raise UploadRuleError("upload_missing")
    file_field = getattr(instance, field)
    previous = file_field.name or None
    file_field.name = key or ""
    instance.save(update_fields=[field])
    if previous and previous != key:
        transaction.on_commit(lambda: storage.delete_file(previous))
