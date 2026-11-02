# Production image for the Django ASGI backend (also used by celery worker / beat).
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements/ requirements/
RUN pip install -r requirements/base.txt

COPY . .

RUN DJANGO_SETTINGS_MODULE=config.settings.base DJANGO_SECRET_KEY=build-only \
    python manage.py collectstatic --noinput \
    && useradd --create-home --uid 1000 app \
    && chown -R app:app /app
USER app

EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
