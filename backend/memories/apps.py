from django.apps import AppConfig


class MemoriesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "memories"

    def ready(self) -> None:
        from . import signals  # noqa: F401
