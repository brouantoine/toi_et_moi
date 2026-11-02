"""Signed, expiring tokens for email verification.

Password reset uses Django's default_token_generator (invalidated as soon as the
password changes, so a reset link cannot be reused).
"""

from django.core import signing

from .models import User

EMAIL_VERIFICATION_SALT = "accounts.email-verification"
EMAIL_VERIFICATION_MAX_AGE = 60 * 60 * 24 * 3  # 3 days


def make_email_verification_token(user: User) -> str:
    return signing.dumps({"uid": user.pk, "email": user.email}, salt=EMAIL_VERIFICATION_SALT)


def read_email_verification_token(token: str) -> User | None:
    """Return the user for a valid token, None if invalid, expired or email changed."""
    try:
        data = signing.loads(
            token, salt=EMAIL_VERIFICATION_SALT, max_age=EMAIL_VERIFICATION_MAX_AGE
        )
    except signing.BadSignature:  # includes SignatureExpired
        return None
    user = User.objects.filter(pk=data.get("uid"), is_active=True).first()
    if user is None or user.email != data.get("email"):
        return None
    return user
