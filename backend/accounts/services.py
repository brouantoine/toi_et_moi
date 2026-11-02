"""Account business logic (kept out of views and serializers)."""

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


@transaction.atomic
def register_user(
    *, email: str, password: str, first_name: str, language: str = "fr", timezone: str = "UTC"
) -> User:
    candidate = User(email=email.lower(), first_name=first_name)
    validate_password(password, user=candidate)
    return User.objects.create_user(
        email, password, first_name=first_name, language=language, timezone=timezone
    )


def issue_tokens(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def revoke_refresh_token(raw_refresh: str) -> None:
    """Blacklist a refresh token (logout). Invalid tokens raise TokenError."""
    RefreshToken(raw_refresh).blacklist()  # type: ignore[arg-type]
