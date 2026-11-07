from celery import shared_task

from . import services


@shared_task
def send_morning_invitations() -> int:
    return services.send_morning_invitations()


@shared_task
def forget_old_moods() -> int:
    return services.forget_old_moods()
