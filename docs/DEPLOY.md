# Déploiement

> Guide complet rédigé en P11.6. Éléments déjà fixés :

- Image de production : `backend/Dockerfile` (Daphne ASGI sur le port 8000). La même image sert au worker (`celery -A config worker`) et à Beat (`celery -A config beat`).
- Settings : `DJANGO_SETTINGS_MODULE=config.settings.prod`. Variables obligatoires : `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `REDIS_URL`, `S3_*`, `FIELD_ENCRYPTION_KEYS`. Voir `backend/.env.example`.
- Vérification : `python manage.py check --deploy --settings=config.settings.prod`.
