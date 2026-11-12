import pytest
from django.test import Client


@pytest.mark.parametrize("path", ["/legal/privacy/", "/legal/terms/", "/support/"])
@pytest.mark.parametrize(("lang", "word"), [("fr", "Bolingo"), ("en", "Bolingo")])
def test_store_pages_are_public_in_both_languages(path: str, lang: str, word: str) -> None:
    response = Client().get(path, {"lang": lang})
    assert response.status_code == 200
    assert word in response.content.decode()


def test_terms_state_the_auto_renewal_rules() -> None:
    text = Client().get("/legal/terms/", {"lang": "fr"}).content.decode()
    assert "se renouvelle automatiquement" in text and "24 heures" in text
    english = Client().get("/legal/terms/", HTTP_ACCEPT_LANGUAGE="en-GB").content.decode()
    assert "renews automatically" in english


@pytest.mark.parametrize(("lang", "words"), [("fr", "couple"), ("en", "couple")])
def test_home_page_presents_the_app_and_links_the_legal_pages(lang: str, words: str) -> None:
    text = Client().get("/", {"lang": lang}).content.decode()
    assert words in text
    assert "/legal/terms/" in text and "/legal/privacy/" in text and "/support/" in text


@pytest.mark.parametrize(
    ("lang", "word"), [("fr", "Sans l'application"), ("en", "Without the app")]
)
def test_deletion_page_explains_how_to_ask_without_the_app(
    settings: object, lang: str, word: str
) -> None:
    settings.ACCOUNT_DELETION_EMAIL = "suppression@example.com"  # type: ignore[attr-defined]
    text = Client().get("/legal/delete-account/", {"lang": lang}).content.decode()
    assert word in text.replace("&#x27;", "'")
    assert "suppression@example.com" in text and "14" in text
