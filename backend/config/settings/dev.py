from .base import *  # noqa: F403
from .env import env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = ["*"]

# Local "lite" mode for trying the app on a phone without Docker (no Redis, no worker):
# DJANGO_LOCAL_LITE=1 → in-process real-time layer and Celery tasks run immediately.
if env_bool("DJANGO_LOCAL_LITE", False):
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = False
