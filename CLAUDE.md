# CLAUDE.md — Bolingo

Boucle autonome : lire `PROMPT.md` (ne le modifier que sur demande explicite de l'utilisateur, tracée dans DECISIONS.md), puis `docs/PLAN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`.

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
- **Icônes : uniquement Lucide** via `<Icon icon={X} />` de `@/ui` (`lucide-react-native`). Jamais d'emoji dans l'UI ni dans les traductions (rendu Twemoji refusé par l'utilisateur) ; un test bloque tout emoji dans `mobile/src`.
- Marque : `mobile/src/config/brand.json` (lu par `brand.ts` et `app.config.ts`) et `BRAND_NAME` (backend).

## Pièges connus
- Python 3.12 n'est pas dans le PATH : toujours passer par `backend\.venv`.
- Django 6.1 : avertissement `EMAIL_BACKEND` déprécié → passer à `MAILERS` en P1.3.
- `react-dom` doit avoir exactement la même version que `react` (conflit de dépendances npm sinon).
- Le modèle User personnalisé (P1.1) doit exister avant toute autre migration d'app.
- RNTL v14 : `await render(...)` et `await fireEvent.press(...)`.
- `app.config.ts` ne peut importer que du JSON/JS, pas de `.ts`.
- npm échoue en ECONNRESET sur ce réseau : préfixer avec `NODE_OPTIONS=--dns-result-order=ipv4first` (IPv4 d'abord). Si `npx expo install` échoue, lire la version dans `node_modules/expo/bundledNativeModules.json` et installer avec npm.

- Linux (poste actuel) : mêmes commandes avec `backend/.venv/bin/python` ; `make` disponible.
- Lancer `expo start` génère `.expo/types` (routes typées strictes) et `expo-env.d.ts` : les supprimer avant `tsc` tant que des routes référencées n'existent pas encore (la CI n'a pas ces fichiers).
- Design system : toute surface tappable passe par `PressableScale` ; les cartes prennent `useSurfaceStyle()` (ombre en clair, filet en sombre) ; aucune couleur en dur hors `src/ui/tokens.ts`.

## Git
- Remote `origin` = https://github.com/brouantoine/toi_et_moi (push autorisé par l'utilisateur, voir DECISIONS.md). Pousser `main` après chaque commit : `git push origin main`.
- Validation backend en une commande (Git Bash) : `sh backend/scripts/validate.sh`. Le `.ps1` équivalent exige `-ExecutionPolicy Bypass`.
