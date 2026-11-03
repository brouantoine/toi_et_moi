import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import IntegrityError

from couples.tests.factories import make_couple
from memories.models import Memory, MemoryReaction

from .factories import MemoryCommentFactory, MemoryFactory, MemoryPhotoFactory

pytestmark = pytest.mark.django_db


def test_memory_defaults_and_ordering() -> None:
    couple, alice, _ = make_couple()
    older = MemoryFactory(couple=couple, created_by=alice, happened_on="2020-01-01")
    newer = MemoryFactory(couple=couple, created_by=alice, happened_on="2024-01-01")
    assert list(Memory.objects.all()) == [newer, older]
    assert older.type == "moment" and older.tags == []
    assert str(older).startswith("Souvenir")


def test_one_heart_per_person() -> None:
    couple, alice, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    reaction = MemoryReaction.objects.create(memory=memory, user=alice)
    assert str(reaction).startswith("heart")
    with pytest.raises(IntegrityError):
        MemoryReaction.objects.create(memory=memory, user=alice)


def test_deleting_a_memory_really_deletes_its_files(django_capture_on_commit_callbacks) -> None:
    couple, alice, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    keys = [f"couples/{couple.pk}/memories/a.jpg", f"couples/{couple.pk}/memories/a_thumb.jpg"]
    for key in keys:
        default_storage.save(key, ContentFile(b"img"))
    photo = MemoryPhotoFactory(memory=memory, key=keys[0], thumbnail_key=keys[1])
    assert str(photo) == keys[0]
    MemoryCommentFactory(memory=memory, author=alice)
    with django_capture_on_commit_callbacks(execute=True):
        memory.delete()
    assert not any(default_storage.exists(k) for k in keys)


def test_files_survive_a_rolled_back_deletion(django_capture_on_commit_callbacks) -> None:
    couple, alice, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    key = f"couples/{couple.pk}/memories/keep.jpg"
    default_storage.save(key, ContentFile(b"img"))
    MemoryPhotoFactory(memory=memory, key=key)
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        memory.delete()
    assert len(callbacks) == 1  # deferred until commit, not run on rollback
    assert default_storage.exists(key)


def test_author_deletion_keeps_the_shared_memory() -> None:
    couple, alice, _ = make_couple()
    memory = MemoryFactory(couple=couple, created_by=alice)
    comment = MemoryCommentFactory(memory=memory, author=alice)
    alice.delete()
    memory.refresh_from_db()
    comment.refresh_from_db()
    assert memory.created_by is None and comment.author is None
    assert str(comment).startswith("Je m'en")
