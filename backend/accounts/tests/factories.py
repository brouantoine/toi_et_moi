import factory

from accounts.models import User

DEFAULT_PASSWORD = "correct-horse-battery"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    timezone = "Europe/Paris"
    email_verified = True
    password = factory.django.Password(DEFAULT_PASSWORD)
