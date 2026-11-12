"""Comptes de démonstration pour la revue App Store / Google Play.

python manage.py comptes_revue --mot-de-passe "..."

Crée (ou remet en état) deux comptes déjà en couple, avec une date de début et un an de
Bolingo Plus offert, pour que les testeurs d'Apple voient toute l'application.
"""

import secrets
from datetime import date
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction

from accounts.models import User
from billing import services as billing
from couples.services import create_couple, get_current_couple, join_couple

ACCOUNTS = (("review.a@bolingo.ci", "Alex"), ("review.b@bolingo.ci", "Sam"))


class Command(BaseCommand):
    help = "Crée les deux comptes de démonstration (en couple, avec Plus) pour la revue."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--mot-de-passe", dest="password", default="")

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        password = options["password"] or secrets.token_urlsafe(12)
        users = []
        for email, name in ACCOUNTS:
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(email, password, first_name=name, language="en")
            else:
                user.set_password(password)
            user.email_verified = True
            user.save()
            users.append(user)
        first, second = users
        couple = get_current_couple(first)
        if couple is None:
            couple, invitation = create_couple(first, start_date=date(2024, 2, 14))
            join_couple(second, invitation.code)
        if not couple.premium:
            billing.grant(first, 365, "comptes de revue App Store")
        self.stdout.write(self.style.SUCCESS("Comptes de revue prêts :"))
        for email, _ in ACCOUNTS:
            self.stdout.write(f"  {email}  /  {password}")
