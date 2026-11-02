# Progression

## 2026-11-02 — P0 Bootstrap (P0.1, P0.2, P0.3)
- Fichiers clés : `backend/config/settings/{base,dev,test,prod}.py`, `backend/core/` (health), `mobile/app.config.ts`, `mobile/src/config/brand.ts`, `mobile/src/ui/`, `mobile/src/i18n/`, `docker-compose.yml`, `Makefile`, `.github/workflows/ci.yml`, `docs/PLAN.md`.
- À savoir : Git et Node.js ont été installés via winget ; Python 3.12 est utilisé via `backend/.venv` (hors PATH). Docker et `make` sont absents de la machine : les tests tournent sans Docker, et les commandes PowerShell équivalentes sont dans `CLAUDE.md`.
- `loop.sh` n'existait pas : à fournir par l'humain (voir `HUMAN_TODO.md`).

## 2026-11-02 — P1.1 Modèle User personnalisé
- Fichiers clés : `backend/accounts/models.py`, `accounts/tests/factories.py`, `backend/scripts/validate.ps1` (validation backend en une commande).
- À savoir : login par email, `display_name` = surnom sinon prénom, heures calmes par défaut 22 h–8 h, fuseau IANA validé. `django_stubs_ext.monkeypatch()` activé (génériques Django à l'exécution).

## 2026-11-02 — P1.2 Inscription + JWT
- Fichiers clés : `backend/accounts/{services,serializers,views,urls}.py`, `accounts/tests/test_auth_api.py`, `backend/conftest.py`.
- Endpoints : `POST /api/v1/auth/register/`, `auth/token/`, `auth/token/refresh/` (rotation + blacklist), `auth/logout/`. Throttle `auth` = 10/min (variable `THROTTLE_AUTH`).

## 2026-11-02 — P1.3 Vérification email + mot de passe oublié
- Fichiers clés : `backend/accounts/{tokens,services,web_views,web_urls,tasks}.py`, `backend/core/emails.py`, `backend/templates/emails/*.{fr,en}.txt`, `backend/templates/web/*.html`.
- Endpoints : `auth/verify-email/`, `auth/verify-email/resend/`, `auth/password-reset/` (toujours 204), `auth/password-reset/confirm/`. Pages web : `/account/verify-email/<token>/`, `/account/reset/<uid>/<token>/`.
- À savoir : emails envoyés via une tâche Celery ; settings email migrés vers `MAILERS` (Django 6.1) ; variables `PUBLIC_BASE_URL`, `SMTP_*`.

## 2026-11-02 — P1.4 Profil /me
- Fichiers clés : `backend/accounts/views.py` (`MeView`), `accounts/tests/test_me_api.py`.
- `GET/PATCH /api/v1/me/` : email et `email_verified` en lecture seule, fuseau IANA et langue fr/en validés. Avatar en P2.7.

## 2026-11-02 — P1.5 Couple et invitation
- Fichiers clés : `backend/couples/{models,services,admin}.py`, `couples/tests/factories.py` (`make_couple()`), `couples/tests/test_services.py`.
- À savoir : appartenance via `CoupleMember.is_current` avec contrainte unique en base (un seul couple courant par utilisateur). Codes de 6 caractères sans 0/O/1/I/L, 48 h, un nouveau code révoque l'ancien. Erreurs métier = `CoupleError(code)` avec codes stables (`invalid_code`, `expired_code`, `own_couple`, `already_in_couple`, `couple_full`, `couple_not_pending`, `no_pending_couple`).

## 2026-11-02 — P1.6 Mixin de cloisonnement couple/auteur
- Fichiers clés : `backend/core/mixins.py` (`CoupleScopedQuerysetMixin`), `core/permissions.py` (`HasActiveCouple`, `request_couple`), `core/pagination.py`, app de test `core/tests/scoping/` (installée seulement en settings de test), `core/tests/test_scoping_mixin.py`.
- Usage : `couple_field` (défaut "couple"), `author_field`, `private=True` ; objets hors périmètre → 404 ; à la mise à jour, couple et auteur ne peuvent pas être changés ; pas de couple actif → 403 `no_active_couple`.
- Pagination par défaut : curseur trié sur `-id` (réponse `{next, previous, results}`).
