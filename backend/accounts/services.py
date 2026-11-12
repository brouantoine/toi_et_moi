"""Account business logic (kept out of views and serializers)."""

import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialAccount, User
from .social import SocialAuthError, SocialIdentity
from .tasks import send_email_task
from .tokens import make_email_verification_token, read_email_verification_token

logger = logging.getLogger(__name__)


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


# --- Social sign-in (identity already verified by accounts.social) ---


@transaction.atomic
def sign_in_with_identity(identity: SocialIdentity, language: str = "fr") -> tuple[User, bool]:
    """Find or create the user for a verified provider identity. Returns (user, created)."""
    link = (
        SocialAccount.objects.select_related("user")
        .filter(provider=identity.provider, subject=identity.subject)
        .first()
    )
    if link is not None:
        return link.user, False

    user: User | None = None
    if identity.email and identity.email_verified:
        user = User.objects.filter(email__iexact=identity.email).first()
    created = False
    if user is None:
        if not identity.email:
            raise SocialAuthError("email_required")
        if User.objects.filter(email__iexact=identity.email).exists():
            # Unverified provider email matching an account: never link automatically.
            raise SocialAuthError("email_in_use")
        user = User.objects.create_user(
            identity.email,
            None,
            first_name=identity.first_name or identity.email.split("@")[0][:60],
            language=language,
            email_verified=identity.email_verified,
        )
        created = True
    elif identity.email_verified and not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
    SocialAccount.objects.create(user=user, provider=identity.provider, subject=identity.subject)
    return user, created


#: Typed by the person to confirm (case-insensitive), in either language.
DELETE_CONFIRMATIONS = {"supprimer", "delete"}


def delete_account(user: User) -> None:
    """Erases the account for good (App Store guideline 5.1.1(v)).

    The couple's shared space (messages, memories, games, coach, calls...) is erased with
    it: the partner keeps their own account, is told, and can start a new space. Stored
    files (photos, voice notes, avatars) are erased from storage once the deletion is
    committed. App Store / Play subscriptions are cancelled in the store, not here.
    """
    from core import storage
    from couples.services import get_current_couple
    from games.models import Answer
    from messaging.models import Message
    from notifications.models import Kind
    from notifications.services import notify

    from . import messages

    keys: list[str] = []
    if user.avatar and user.avatar.name:
        keys.append(user.avatar.name)
    with transaction.atomic():
        couple = get_current_couple(user)
        partner = couple.partner_of(user) if couple else None
        if couple is not None:
            keys += list(
                Message.objects.filter(couple=couple)
                .exclude(media_key="")
                .values_list("media_key", flat=True)
            )
            keys += list(
                Answer.objects.filter(couple=couple)
                .exclude(media_key="")
                .values_list("media_key", flat=True)
            )
            if couple.photo and couple.photo.name:
                keys.append(couple.photo.name)
            couple.delete()  # memory photos are erased by their own signal
        name = user.display_name
        user.delete()

        def erase_files() -> None:
            for key in keys:
                try:
                    storage.delete_file(key)
                except Exception:  # best effort: a lost file never blocks the deletion
                    logger.warning("account deletion: could not erase a stored file")

        transaction.on_commit(erase_files)
    if partner is not None:
        notify(
            partner,
            Kind.ORGANIZATION,
            messages.text(partner.language, "partner_deleted_title"),
            messages.text(partner.language, "partner_deleted_body", name=name),
            {"screen": "couple"},
            respect_quiet_hours=False,
        )
