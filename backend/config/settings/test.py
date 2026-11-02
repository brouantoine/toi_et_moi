"""Test settings without Docker: SQLite unless DATABASE_URL, eager Celery, in-memory layers."""

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production"  # noqa: S105
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Deterministic test key (never used outside tests).
FIELD_ENCRYPTION_KEYS = ["dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMTIzNDU="]
