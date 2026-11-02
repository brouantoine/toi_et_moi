# CLAUDE.md — Nous Deux

Boucle autonome : lire `PROMPT.md` (ne jamais le modifier), puis `docs/PLAN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`.

## Commandes (Windows PowerShell — `make` absent ; sinon voir `Makefile`)
PATH à recharger dans chaque shell : `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`

Backend (`cd backend`, Python = `.\.venv\Scripts\python.exe`) :
```
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m mypy .
.\.venv\Scripts\python.exe -m pytest --cov
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run --settings=config.settings.test
```
Mobile (`cd mobile`) : `npx tsc --noEmit`, `npx eslint .`, `npx jest`, `npx expo-doctor`.
Ajouter un paquet mobile : `npx expo install <pkg>` (jamais `npm install` pour un module natif).

## Conventions
- Code/commits en anglais, UI fr (tutoiement) + en via i18n, docs en français.
- Backend : une app par domaine, logique dans `services.py`, serializers fins, querysets filtrés par le mixin de `core` (P1.6), tests « partenaire » et « étranger » pour chaque endpoint.
- Mobile : routes dans `src/app/` uniquement, écrans dans `src/features/<domaine>/`, design system `src/ui/`, alias `@/` → `src/`.
- Marque : `mobile/src/config/brand.json` (lu par `brand.ts` et `app.config.ts`) et `BRAND_NAME` (backend).

## Pièges connus
- Python 3.12 n'est pas dans le PATH : toujours passer par `backend\.venv`.
- Django 6.1 : avertissement `EMAIL_BACKEND` déprécié → passer à `MAILERS` en P1.3.
- `react-dom` doit avoir exactement la même version que `react` (conflit de dépendances npm sinon).
- Le modèle User personnalisé (P1.1) doit exister avant toute autre migration d'app.
- RNTL v14 : `await render(...)` et `await fireEvent.press(...)`.
- `app.config.ts` ne peut importer que du JSON/JS, pas de `.ts`.
