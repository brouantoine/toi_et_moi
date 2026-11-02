# Progression

## 2026-11-02 — P0 Bootstrap (P0.1, P0.2, P0.3)
- Fichiers clés : `backend/config/settings/{base,dev,test,prod}.py`, `backend/core/` (health), `mobile/app.config.ts`, `mobile/src/config/brand.ts`, `mobile/src/ui/`, `mobile/src/i18n/`, `docker-compose.yml`, `Makefile`, `.github/workflows/ci.yml`, `docs/PLAN.md`.
- À savoir : Git et Node.js ont été installés via winget ; Python 3.12 est utilisé via `backend/.venv` (hors PATH). Docker et `make` sont absents de la machine : les tests tournent sans Docker, et les commandes PowerShell équivalentes sont dans `CLAUDE.md`.
- `loop.sh` n'existait pas : à fournir par l'humain (voir `HUMAN_TODO.md`).

## 2026-11-02 — P1.1 Modèle User personnalisé
- Fichiers clés : `backend/accounts/models.py`, `accounts/tests/factories.py`, `backend/scripts/validate.ps1` (validation backend en une commande).
- À savoir : login par email, `display_name` = surnom sinon prénom, heures calmes par défaut 22 h–8 h, fuseau IANA validé. `django_stubs_ext.monkeypatch()` activé (génériques Django à l'exécution).
