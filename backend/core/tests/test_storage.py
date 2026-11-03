import base64
import json
import re
from typing import Any

import pytest
from botocore.stub import Stubber
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from core import storage
from core.storage import StorageError


def decode_policy(fields: dict[str, str]) -> dict[str, Any]:
    policy: dict[str, Any] = json.loads(base64.b64decode(fields["policy"]))
    return policy


def test_build_key_is_namespaced_and_unguessable() -> None:
    key = storage.build_key(
        owner="couples", owner_id=12, kind="memories", content_type="image/jpeg"
    )
    assert re.fullmatch(r"couples/12/memories/[0-9a-f]{32}\.jpg", key)
    other = storage.build_key(
        owner="couples", owner_id=12, kind="memories", content_type="image/jpeg"
    )
    assert key != other


def test_build_key_rejects_unknown_owner_and_type() -> None:
    with pytest.raises(ValueError):
        storage.build_key(owner="admins", owner_id=1, kind="x", content_type="image/jpeg")
    with pytest.raises(StorageError) as exc:
        storage.build_key(owner="users", owner_id=1, kind="x", content_type="application/pdf")
    assert exc.value.code == "unsupported_type"


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("couples/12/memories/abc.jpg", True),
        ("couples/13/memories/abc.jpg", False),
        ("couples/12/avatars/abc.jpg", False),
        ("couples/12/memories/sub/abc.jpg", False),
        ("couples/12/memories/../../13/memories/abc.jpg", False),
        ("users/12/memories/abc.jpg", False),
    ],
)
def test_key_belongs_to(key: str, expected: bool) -> None:
    assert storage.key_belongs_to(key, owner="couples", owner_id=12, kind="memories") is expected


def test_presigned_post_enforces_type_and_size() -> None:
    ticket = storage.presign_image_upload(
        owner="couples", owner_id=7, kind="memories", content_type="image/png", max_bytes=1000
    )
    assert ticket.key.startswith("couples/7/memories/") and ticket.key.endswith(".png")
    assert ticket.fields["key"] == ticket.key
    assert ticket.fields["Content-Type"] == "image/png"
    assert ticket.url.endswith("/nousdeux")
    conditions = decode_policy(ticket.fields)["conditions"]
    assert ["content-length-range", 1, 1000] in conditions
    assert {"Content-Type": "image/png"} in conditions
    assert {"key": ticket.key} in conditions
    assert ticket.expires_in == storage.UPLOAD_URL_TTL_SECONDS


def test_presigning_makes_no_network_call() -> None:
    client = storage._s3_client()
    with Stubber(client) as stub:  # any real API call would raise
        storage.presign_image_upload(
            owner="users", owner_id=1, kind="avatars", content_type="image/jpeg"
        )
        stub.assert_no_pending_responses()


def test_uploaded_size_signed_url_and_delete() -> None:
    key = "couples/1/memories/test.jpg"
    assert storage.uploaded_size(key) is None
    default_storage.save(key, ContentFile(b"12345"))
    assert storage.uploaded_size(key) == 5
    assert storage.signed_url(key)
    assert storage.signed_url(None) is None
    assert storage.signed_url("") is None
    storage.delete_file(key)
    storage.delete_file(key)  # idempotent
    storage.delete_file(None)
    assert storage.uploaded_size(key) is None
