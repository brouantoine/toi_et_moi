from django.apps import AppConfig


class ScopingTestConfig(AppConfig):
    """Test-only app used to prove the couple/author scoping mixin generically."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core.tests.scoping"
    label = "scoping"
