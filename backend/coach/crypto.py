"""Encryption at rest for the shared coach thread (Fernet, keys in FIELD_ENCRYPTION_KEYS).

The first key encrypts; every key can decrypt, so keys can be rotated. Without any key
(local development) the text is stored as is, clearly prefixed.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings

PLAIN_PREFIX = "plain:"
CIPHER_PREFIX = "f1:"


def _fernet() -> MultiFernet | None:
    keys = [key for key in settings.FIELD_ENCRYPTION_KEYS if key]
    return MultiFernet([Fernet(key.encode()) for key in keys]) if keys else None


def encrypt(text: str) -> str:
    fernet = _fernet()
    if fernet is None:
        return PLAIN_PREFIX + text
    return CIPHER_PREFIX + fernet.encrypt(text.encode()).decode()


def decrypt(stored: str) -> str:
    if stored.startswith(PLAIN_PREFIX):
        return stored[len(PLAIN_PREFIX) :]
    fernet = _fernet()
    if fernet is None or not stored.startswith(CIPHER_PREFIX):
        return ""
    try:
        return fernet.decrypt(stored[len(CIPHER_PREFIX) :].encode()).decode()
    except InvalidToken:
        return ""
