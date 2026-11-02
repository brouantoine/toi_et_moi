"""Account business logic (kept out of views and serializers)."""

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .tasks import send_email_task
from .tokens import make_email_verification_token, read_email_verification_token


def _absolute(path: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}{path}"


@transaction.atomic
def register_user(
    *, email: str, password: str, first_name: str, language: str = "fr", timezone: str = "UTC"
) -> User:
    candidate = User(email=email.lower(), first_name=first_name)
    validate_password(password, user=candidate)
    user = User.objects.create_user(
        email, password, first_name=first_name, language=language, timezone=timezone
    )
    send_verification_email(user)
    return user


def issue_tokens(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def revoke_refresh_token(raw_refresh: str) -> None:
    """Blacklist a refresh token (logout). Invalid tokens raise TokenError."""
    RefreshToken(raw_refresh).blacklist()  # type: ignore[arg-type]


# --- Email verification ---


def send_verification_email(user: User) -> None:
    if user.email_verified:
        return
    token = make_email_verification_token(user)
    link = _absolute(reverse("web-verify-email", args=[token]))
    send_email_task.delay(
        user.email, "verify_email", user.language, {"name": user.first_name, "link": link}
    )


def verify_email(token: str) -> bool:
    user = read_email_verification_token(token)
    if user is None:
        return False
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
    return True


# --- Password reset (never reveals whether an email exists) ---


def request_password_reset(email: str) -> None:
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None or not user.has_usable_password():
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = _absolute(reverse("web-password-reset-confirm", args=[uid, token]))
    send_email_task.delay(
        user.email, "password_reset", user.language, {"name": user.first_name, "link": link}
    )


def user_from_reset_link(uidb64: str, token: str) -> User | None:
    try:
        pk = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=pk, is_active=True)
    except (ValueError, TypeError, OverflowError, User.DoesNotExist):
        return None
    return user if default_token_generator.check_token(user, token) else None


def confirm_password_reset(uidb64: str, token: str, new_password: str) -> bool:
    user = user_from_reset_link(uidb64, token)
    if user is None:
        return False
    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    return True
