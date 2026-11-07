from django.apps import AppConfig


class RitualsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "rituals"

    def ready(self) -> None:
        from . import signals  # noqa: F401
