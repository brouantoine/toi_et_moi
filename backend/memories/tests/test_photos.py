import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image
from rest_framework.test import APIClient

from couples.tests.factories import make_couple
from memories.models import MAX_PHOTOS_PER_MEMORY, MemoryPhoto
from memories.tasks import generate_thumbnail, thumbnail_key_for

from .factories import MemoryFactory, MemoryPhotoFactory

pytestmark = pytest.mark.django_db


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def jpeg_bytes(size=(1600, 1200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 120, 90)).save(buffer, format="JPEG")
    return buffer.getvalue()


def photos_url(memory_id: int) -> str:
    return f"/api/v1/memories/{memory_id}/photos/"


@pytest.fixture
def setup():
    couple, alice, bob = make_couple()
    _, carol, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    return couple, alice, bob, carol, memory


def upload(key: str) -> None:
    default_storage.save(key, ContentFile(jpeg_bytes()))


def test_full_upload_flow_with_thumbnail(setup, django_capture_on_commit_callbacks) -> None:
    couple, alice, bob, _, memory = setup
    ticket = client_for(alice).post(
        photos_url(memory.pk) + "upload-url/", {"content_type": "image/jpeg"}
    )
    assert ticket.status_code == 200, ticket.content
    key = ticket.json()["key"]
    assert key.startswith(f"couples/{couple.pk}/memories/")
    assert ticket.json()["form_fields"]["key"] == key
    upload(key)
    with django_capture_on_commit_callbacks(execute=True):
        confirmed = client_for(bob).post(photos_url(memory.pk), {"key": key}, format="json")
    assert confirmed.status_code == 201, confirmed.content
    photo = MemoryPhoto.objects.get()
    assert photo.thumbnail_key == thumbnail_key_for(key)
    assert (photo.width, photo.height) == (1600, 1200)
    with default_storage.open(photo.thumbnail_key, "rb") as f:
        assert max(Image.open(f).size) <= 640


def test_confirm_rejects_foreign_or_missing_keys(setup) -> None:
    couple, alice, _, _, memory = setup
    client = client_for(alice)
    foreign = f"couples/{couple.pk + 1000}/memories/x.jpg"
    upload(foreign)
    assert client.post(photos_url(memory.pk), {"key": foreign}).json() == {"code": "invalid_key"}
    missing = f"couples/{couple.pk}/memories/never-uploaded.jpg"
    assert client.post(photos_url(memory.pk), {"key": missing}).json() == {"code": "upload_missing"}


def test_same_key_cannot_be_confirmed_twice(setup) -> None:
    couple, alice, _, _, memory = setup
    key = f"couples/{couple.pk}/memories/dup.jpg"
    upload(key)
    assert client_for(alice).post(photos_url(memory.pk), {"key": key}).status_code == 201
    assert client_for(alice).post(photos_url(memory.pk), {"key": key}).json() == {
        "code": "invalid_key"
    }


def test_max_ten_photos(setup) -> None:
    couple, alice, _, _, memory = setup
    for i in range(MAX_PHOTOS_PER_MEMORY):
        MemoryPhotoFactory(memory=memory, key=f"couples/{couple.pk}/memories/{i}.jpg")
    client = client_for(alice)
    ticket = client.post(photos_url(memory.pk) + "upload-url/", {"content_type": "image/jpeg"})
    assert ticket.json() == {"code": "too_many_photos"}
    key = f"couples/{couple.pk}/memories/eleven.jpg"
    upload(key)
    assert client.post(photos_url(memory.pk), {"key": key}).json() == {"code": "too_many_photos"}


def test_unsupported_type(setup) -> None:
    _, alice, _, _, memory = setup
    response = client_for(alice).post(
        photos_url(memory.pk) + "upload-url/", {"content_type": "video/mp4"}
    )
    assert response.json() == {"code": "unsupported_type"}


def test_delete_photo_removes_files(setup, django_capture_on_commit_callbacks) -> None:
    couple, _, bob, _, memory = setup
    key = f"couples/{couple.pk}/memories/del.jpg"
    upload(key)
    photo = MemoryPhotoFactory(memory=memory, key=key)
    with django_capture_on_commit_callbacks(execute=True):
        response = client_for(bob).delete(f"{photos_url(memory.pk)}{photo.pk}/")
    assert response.status_code == 204
    assert not default_storage.exists(key)


def test_stranger_cannot_touch_photos(setup) -> None:
    couple, _, _, carol, memory = setup
    key = f"couples/{couple.pk}/memories/s.jpg"
    upload(key)
    photo = MemoryPhotoFactory(memory=memory, key=key)
    stranger = client_for(carol)
    assert (
        stranger.post(
            photos_url(memory.pk) + "upload-url/", {"content_type": "image/jpeg"}
        ).status_code
        == 404
    )
    assert stranger.post(photos_url(memory.pk), {"key": key}).status_code == 404
    assert stranger.delete(f"{photos_url(memory.pk)}{photo.pk}/").status_code == 404
    assert MemoryPhoto.objects.filter(pk=photo.pk).exists()


def test_photo_of_another_memory_is_not_reachable_through_wrong_parent(setup) -> None:
    couple, alice, _, _, memory = setup
    other_memory = MemoryFactory(couple=couple, created_by=alice)
    photo = MemoryPhotoFactory(memory=other_memory, key=f"couples/{couple.pk}/memories/o.jpg")
    response = client_for(alice).delete(f"{photos_url(memory.pk)}{photo.pk}/")
    assert response.status_code == 404


def test_thumbnail_task_is_robust() -> None:
    generate_thumbnail(999999)  # missing photo: no error
    couple, alice, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    bad = MemoryPhotoFactory(memory=memory, key=f"couples/{couple.pk}/memories/bad.jpg")
    default_storage.save(bad.key, ContentFile(b"not an image"))
    generate_thumbnail(bad.pk)
    bad.refresh_from_db()
    assert bad.thumbnail_key == ""
    gone = MemoryPhotoFactory(memory=memory, key=f"couples/{couple.pk}/memories/gone.jpg")
    generate_thumbnail(gone.pk)  # original not uploaded: skipped
