from .base import *  # noqa: F403
from .env import env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = ["*"]
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
