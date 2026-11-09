from celery import shared_task

from . import services


@shared_task
def send_continuous_reminders() -> int:
    return services.send_continuous_reminders()
