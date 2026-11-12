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
