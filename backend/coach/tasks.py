from celery import shared_task

from . import services


@shared_task
def reply(couple_id: int, message_id: int) -> None:
    services.answer(couple_id, message_id)
