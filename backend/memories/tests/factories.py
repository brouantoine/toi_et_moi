import datetime as dt

import factory

from memories.models import Memory, MemoryComment, MemoryPhoto, MemoryType


class MemoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Memory

    title = factory.Sequence(lambda n: f"Souvenir {n}")
    body = "Un moment à nous."
    happened_on = dt.date(2022, 6, 21)
    type = MemoryType.MOMENT
    tags = factory.LazyFunction(list)


class MemoryPhotoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = MemoryPhoto

    key = factory.Sequence(lambda n: f"couples/1/memories/photo{n}.jpg")


class MemoryCommentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = MemoryComment

    body = "Je m'en souviens comme si c'était hier."
