"""Base settings shared by every environment. All secrets come from the environment."""

from datetime import timedelta
from pathlib import Path

import dj_database_url
import django_stubs_ext

from .env import env_bool, env_int, env_list, env_str

# Allow generic subscripting of Django classes at runtime (e.g. ModelAdmin[User]).
django_stubs_ext.monkeypatch()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Brand: change the product name here (mobile side: mobile/src/config/brand.ts).
BRAND_NAME = env_str("BRAND_NAME", "Nous Deux")

SECRET_KEY = env_str("DJANGO_SECRET_KEY", "insecure-dev-only-change-me")

# Public URL of this backend (used in email links).
PUBLIC_BASE_URL = env_str("PUBLIC_BASE_URL", "http://localhost:8000")
# Mobile deep link scheme (invitation links: <scheme>://join/<CODE>).
APP_SCHEME = env_str("APP_SCHEME", "nousdeux")
DEFAULT_FROM_EMAIL = env_str("DEFAULT_FROM_EMAIL", "Nous Deux <no-reply@example.com>")

# Email (Django 6.1 MAILERS). Console in dev; SMTP in prod (see prod.py).
MAILERS: dict[str, dict[str, object]] = {
    "default": {"BACKEND": "django.core.mail.backends.console.EmailBackend"}
}
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "channels",
    "storages",
    # Local
    "core",
    "accounts",
    "couples",
    "memories",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.template.context_processors.i18n",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database: Postgres when DATABASE_URL is set, SQLite otherwise.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=env_int("DB_CONN_MAX_AGE", 60),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("en", "English")]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env_str("THROTTLE_ANON", "60/min"),
        "user": env_str("THROTTLE_USER", "600/min"),
        "auth": env_str("THROTTLE_AUTH", "10/min"),
        "join": env_str("THROTTLE_JOIN", "10/min"),
    },
    "DEFAULT_PAGINATION_CLASS": "core.pagination.DefaultCursorPagination",
    "PAGE_SIZE": 30,
}

SPECTACULAR_SETTINGS = {
    "TITLE": f"{BRAND_NAME} API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", 15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", 30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# --- CORS (mobile apps do not need CORS; keep strict for web pages) ---
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "")

# --- Redis / Celery / Channels ---
REDIS_URL = env_str("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = env_str("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = None
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULE: dict[str, dict[str, object]] = {}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# --- Storage (S3-compatible: MinIO locally) ---
AWS_ACCESS_KEY_ID = env_str("S3_ACCESS_KEY", "minioadmin")
AWS_SECRET_ACCESS_KEY = env_str("S3_SECRET_KEY", "minioadmin")
AWS_STORAGE_BUCKET_NAME = env_str("S3_BUCKET", "nousdeux")
AWS_S3_ENDPOINT_URL = env_str("S3_ENDPOINT_URL", "http://localhost:9000")
# Endpoint reachable by phones for presigned uploads (e.g. LAN IP of MinIO in dev).
S3_PUBLIC_ENDPOINT_URL = env_str("S3_PUBLIC_ENDPOINT_URL", "")
AWS_S3_REGION_NAME = env_str("S3_REGION", "us-east-1")
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True
AWS_QUERYSTRING_EXPIRE = env_int("S3_URL_EXPIRE_SECONDS", 900)
AWS_S3_FILE_OVERWRITE = False

STORAGES = {
    "default": {"BACKEND": "storages.backends.s3.S3Storage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# --- Social sign-in: accepted audiences (client ids) ---
# Apple: iOS bundle id(s). Google: OAuth client ids (iOS, Android, web). Empty = disabled.
APPLE_AUDIENCES = env_list("APPLE_AUDIENCES", "com.changeme.nousdeux")
GOOGLE_CLIENT_IDS = env_list("GOOGLE_CLIENT_IDS", "")

# --- Feature flags ---
AI_REFORMULATION_ENABLED = env_bool("AI_REFORMULATION_ENABLED", False)
ANTHROPIC_API_KEY = env_str("ANTHROPIC_API_KEY", "")

# --- Field encryption key for private data (Fernet, urlsafe base64, 32 bytes) ---
FIELD_ENCRYPTION_KEYS = env_list("FIELD_ENCRYPTION_KEYS", "")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
}
