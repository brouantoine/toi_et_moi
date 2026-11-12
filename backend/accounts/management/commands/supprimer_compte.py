"""Supprime un compte à la demande de la personne (demande reçue par email).

python manage.py supprimer_compte personne@exemple.com

Même effet que « Moi > Supprimer mon compte » dans l'application : le compte, l'espace du
couple et les fichiers stockés sont effacés, le ou la partenaire est prévenu.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.models import User
from accounts.services import delete_account


class Command(BaseCommand):
    help = "Supprime définitivement un compte (demande de suppression reçue par email)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")
        parser.add_argument("--oui", action="store_true", help="Ne pas demander confirmation.")

    def handle(self, *args: Any, **options: Any) -> None:
        email = str(options["email"]).strip()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError(f"Aucun compte avec l'email {email}.")
        if not options["oui"]:
            answer = input(f"Supprimer définitivement le compte {user.email} ? Tape oui : ")
            if answer.strip().lower() != "oui":
                self.stdout.write("Annulé.")
                return
        delete_account(user)
        self.stdout.write(self.style.SUCCESS(f"Compte {email} supprimé."))
