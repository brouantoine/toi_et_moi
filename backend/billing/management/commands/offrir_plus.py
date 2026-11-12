"""Offrir Bolingo Plus : python manage.py offrir_plus email@exemple.com 30 --raison "ami"."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.models import User
from billing import services


class Command(BaseCommand):
    help = "Offre des jours de Bolingo Plus à une personne (et donc à son couple)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")
        parser.add_argument("jours", type=int)
        parser.add_argument("--raison", default="")

    def handle(self, *args: Any, **options: Any) -> None:
        user = User.objects.filter(email__iexact=options["email"].strip()).first()
        if user is None:
            raise CommandError("Aucun compte avec cet email.")
        if options["jours"] <= 0:
            raise CommandError("Le nombre de jours doit être positif.")
        gift = services.grant(user, options["jours"], options["raison"])
        self.stdout.write(
            self.style.SUCCESS(
                f"{gift.days} jours de Plus offerts à {user.email} "
                f"(jusqu'au {gift.ends_at:%d/%m/%Y})."
            )
        )
