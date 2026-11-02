"""Server-side verification of Sign in with Apple and Google identity tokens.

Identity tokens are JWTs signed by the provider (RS256). We fetch the provider's public
keys (JWKS, cached), check signature, issuer, audience (our client ids), expiry and,
for Apple, the nonce. Nothing from the client is trusted without this verification.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from functools import cache
from typing import Any

import jwt
from django.conf import settings

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"


class SocialAuthError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class SocialIdentity:
    provider: str
    subject: str
    email: str | None
    email_verified: bool
    first_name: str


@cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=10)


def signing_key(jwks_url: str, token: str) -> Any:
    """Public key matching the token's `kid` (isolated so tests can stub it)."""
    try:
        return _jwks_client(jwks_url).get_signing_key_from_jwt(token).key
    except jwt.PyJWKClientError as exc:
        raise SocialAuthError("invalid_token") from exc


def _decode(token: str, jwks_url: str, audiences: list[str], issuer: Any) -> dict[str, Any]:
    if not audiences:
        raise SocialAuthError("provider_disabled")
    try:
        key = signing_key(jwks_url, token)
        claims: dict[str, Any] = jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            audience=audiences,
            issuer=issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=30,
        )
    except jwt.ExpiredSignatureError as exc:
        raise SocialAuthError("expired_token") from exc
    except jwt.InvalidTokenError as exc:
        raise SocialAuthError("invalid_token") from exc
    return claims


def _as_bool(value: Any) -> bool:
    return value is True or str(value).lower() == "true"


def verify_apple(id_token: str, raw_nonce: str | None, first_name: str = "") -> SocialIdentity:
    claims = _decode(id_token, APPLE_JWKS_URL, settings.APPLE_AUDIENCES, APPLE_ISSUER)
    if raw_nonce is not None:
        expected = hashlib.sha256(raw_nonce.encode()).hexdigest()
        if claims.get("nonce") != expected:
            raise SocialAuthError("invalid_nonce")
    return SocialIdentity(
        provider="apple",
        subject=str(claims["sub"]),
        email=claims.get("email"),
        email_verified=_as_bool(claims.get("email_verified")),
        first_name=first_name,
    )


def verify_google(id_token: str, first_name: str = "") -> SocialIdentity:
    claims = _decode(id_token, GOOGLE_JWKS_URL, settings.GOOGLE_CLIENT_IDS, list(GOOGLE_ISSUERS))
    return SocialIdentity(
        provider="google",
        subject=str(claims["sub"]),
        email=claims.get("email"),
        email_verified=_as_bool(claims.get("email_verified")),
        first_name=first_name or str(claims.get("given_name") or ""),
    )
