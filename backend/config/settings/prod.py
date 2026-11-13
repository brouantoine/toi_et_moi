"""Hardened production settings. Every secret MUST come from the environment."""

from .env import load_env_file

load_env_file()  # backend/.env (secrets of this machine) before the base settings read them

from django.core.exceptions import ImproperlyConfigured  # noqa: E402

from .base import *  # noqa: E402, F403
from .env import env_int, env_list, env_str  # noqa: E402

DEBUG = False
SECRET_KEY = env_str("DJANGO_SECRET_KEY")

# Messages and the coach thread are encrypted at rest: never start without a key, or
# they would silently be stored in clear.
if not [key for key in FIELD_ENCRYPTION_KEYS if key]:  # noqa: F405
    raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS is required in production.")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

# One trusted proxy (host Nginx, which overwrites X-Forwarded-For with the real address).
REST_FRAMEWORK["NUM_PROXIES"] = env_int("NUM_PROXIES", 1)  # noqa: F405

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": env_str("SMTP_HOST", ""),
            "port": env_int("SMTP_PORT", 587),
            "username": env_str("SMTP_USER", ""),
            "password": env_str("SMTP_PASSWORD", ""),
            "use_tls": True,
            "timeout": 10,
        },
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,  # noqa: F405
    }
}

STORAGES = {
    "default": {"BACKEND": "storages.backends.s3.S3Storage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.ManifestStaticFilesStorage"},
}
