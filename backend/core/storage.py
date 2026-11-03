"""Direct-to-S3 uploads and time-limited read URLs.

Uploads use a presigned POST (not PUT): S3 itself enforces the content type and the maximum
size through the signed policy, so a client can never upload something else or something
bigger. Keys are namespaced by couple (shared files) or by user (personal files) and contain
a random UUID, so they cannot be guessed.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from functools import cache
from typing import Any

import boto3
from botocore.client import Config
from django.conf import settings
from django.core.files.storage import default_storage

ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
UPLOAD_URL_TTL_SECONDS = 15 * 60


class StorageError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class UploadTicket:
    key: str
    url: str
    fields: dict[str, str]
    max_bytes: int
    expires_in: int


@cache
def _s3_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_PUBLIC_ENDPOINT_URL or settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def build_key(*, owner: str, owner_id: int, kind: str, content_type: str) -> str:
    """e.g. couples/12/memories/9f1c...e2.jpg (owner: "couples" or "users")."""
    if owner not in {"couples", "users"}:
        raise ValueError(f"unknown owner {owner}")
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise StorageError("unsupported_type")
    return f"{owner}/{owner_id}/{kind}/{uuid.uuid4().hex}.{extension}"


def key_belongs_to(key: str, *, owner: str, owner_id: int, kind: str) -> bool:
    """Prevents a client from confirming a key outside its own namespace."""
    prefix = f"{owner}/{owner_id}/{kind}/"
    return key.startswith(prefix) and "/" not in key[len(prefix) :] and ".." not in key


def presign_image_upload(
    *, owner: str, owner_id: int, kind: str, content_type: str, max_bytes: int = MAX_IMAGE_BYTES
) -> UploadTicket:
    key = build_key(owner=owner, owner_id=owner_id, kind=kind, content_type=content_type)
    post = _s3_client().generate_presigned_post(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, max_bytes],
        ],
        ExpiresIn=UPLOAD_URL_TTL_SECONDS,
    )
    return UploadTicket(
        key=key,
        url=str(post["url"]),
        fields={k: str(v) for k, v in post["fields"].items()},
        max_bytes=max_bytes,
        expires_in=UPLOAD_URL_TTL_SECONDS,
    )


def uploaded_size(key: str) -> int | None:
    """Size of an uploaded object, or None if it does not exist (upload not done)."""
    if not default_storage.exists(key):
        return None
    return int(default_storage.size(key))


def signed_url(key: str | None) -> str | None:
    """Time-limited read URL (S3 query-string auth, see AWS_QUERYSTRING_EXPIRE)."""
    if not key:
        return None
    return str(default_storage.url(key))


def delete_file(key: str | None) -> None:
    """Real deletion of a stored file (idempotent)."""
    if key and default_storage.exists(key):
        default_storage.delete(key)
