# Décisions

Format : date — choix — raison — alternative écartée.

- 2026-11-02 — Dépôt créé dans `C:\Users\DELL\nous-deux` — le dossier de travail initial était le dossier personnel de l'utilisateur, inadapté à un dépôt — créer le dépôt directement dans le dossier personnel.
- 2026-11-02 — Git et Node.js LTS (26.x) installés via winget, Python 3.12 existant utilisé dans `backend/.venv` — outils absents de la machine — aucune alternative viable.
- 2026-11-02 — Docker absent de la machine : les tests tournent sans Docker (SQLite, Celery eager, channel layer en mémoire, stockage `InMemoryStorage`) — prévu par la spec section 4 — installer Docker Desktop (droits admin, redémarrage).
- 2026-11-02 — `make` absent sous Windows : les commandes équivalentes PowerShell sont listées dans `CLAUDE.md`; le Makefile reste la référence (CI, Linux/macOS) — réécrire en script PowerShell.
- 2026-11-02 — Django 6.1.2, DRF 3.18, Expo SDK 58 (React Native 0.88, React 19.3), TypeScript 6 — dernières versions stables au moment du bootstrap — versions antérieures.
- 2026-11-02 — App Django supplémentaire `core` (health, mixin de permissions, stockage, champ chiffré) — utilitaires transverses partagés par toutes les apps métier — les dupliquer ou les mettre dans `config`.
- 2026-11-02 — Settings via un petit module `config/settings/env.py` + `dj-database-url` — pas de dépendance lourde, typé pour mypy — django-environ.
- 2026-11-02 — Pagination DRF par curseur par défaut — stable avec les insertions temps réel et adaptée aux listes infinies — pagination par numéro de page.
- 2026-11-02 — Routes Expo Router dans `mobile/src/app/` (alias `@/*` → `src/*`) — recommandation du template Expo SDK 58 — dossier `app/` à la racine.
- 2026-11-02 — Les valeurs de marque vivent dans `mobile/src/config/brand.json`, ré-exporté et typé par `brand.ts`, et lu par `app.config.ts` — le chargeur de config Expo ne sait pas `require` un fichier `.ts` (erreur « Cannot find module ./src/config/brand ») — dupliquer la chaîne dans les deux fichiers.
- 2026-11-02 — `react-dom` épinglé à la version exacte de `react` (19.3.0) — `react-dom@19.3.1` exige `react@19.3.1` (ERESOLVE) — `--legacy-peer-deps`.
- 2026-11-02 — React Native Testing Library v14 : `render()`/`fireEvent()` sont asynchrones, tous les tests utilisent `await` — API v14 — rester en v13.
- 2026-11-02 — TypeScript 6 ne charge plus les types globaux par défaut : `"types": ["jest", "node"]` dans `mobile/tsconfig.json` — nécessaire pour les tests — imports explicites de `@jest/globals`.
- 2026-11-02 — i18n via `createInstance()` d'i18next (instance dédiée) — évite l'avertissement ESLint `no-named-as-default-member` et l'état global partagé — instance par défaut.
- 2026-11-02 — Client API prévu : types `openapi-typescript` + `openapi-fetch` (très léger, typé par les types générés) — évite tout type écrit à la main — client axios avec types manuels.
- 2026-11-02 — `loop.sh` absent : non créé par l'agent (fichier « ne pas modifier », fourni par l'humain) — noté dans `HUMAN_TODO.md` — en écrire un.
- 2026-11-02 — Django 6.1 déprécie `EMAIL_BACKEND` au profit de `MAILERS` (avertissement en test) — migration planifiée dans P1.3 avec l'envoi d'emails — migrer à l'aveugle dès P0.
- 2026-11-02 — L'inscription renvoie directement les tokens et ne bloque pas l'accès avant vérification de l'email (bandeau côté app) — parcours de couple fluide — bloquer jusqu'à vérification.
- 2026-11-02 — L'inscription signale un email déjà utilisé (nécessaire à l'UX), protégée par le throttle `auth` ; la réinitialisation de mot de passe ne donne, elle, aucun indice — compromis courant — réponse générique à l'inscription avec email explicatif.
- 2026-11-02 — Emails et pages web choisissent un template par langue (`*.fr.txt` / `*.en.txt`, `LANGUAGE_CODE` dans les pages) au lieu de gettext — les outils GNU gettext (msgfmt) sont absents sous Windows — fichiers .po compilés.
- 2026-11-02 — Les liens des emails pointent vers des pages web Django (fonctionnent sur tout appareil, avec ou sans l'app) — robustesse — deep links uniquement.
- 2026-11-02 — **Push GitHub autorisé explicitement par l'utilisateur** (remote `origin` = https://github.com/brouantoine/toi_et_moi, auteur git `brouantoine`). Cette instruction de l'utilisateur prime sur la règle « jamais de git push » de PROMPT.md : pousser `main` après chaque commit — demande directe de l'utilisateur — ne jamais pousser.
- 2026-11-02 — L'espace partagé exige un couple **actif** ; un couple en dissolution n'est plus accessible par l'API courante, l'export des 30 jours passera par l'app `privacy` (P9) — règle simple et sûre — accès en lecture seule pendant la dissolution.
- 2026-11-02 — Le mixin est testé génériquement via une app de test `core.tests.scoping` installée uniquement dans les settings de test — preuve indépendante des apps métier — attendre les premiers modèles métier.
- 2026-11-02 — openapi-typescript 7.13 exige TypeScript 5 alors que l'app est en TypeScript 6 : il est lancé isolément via `npx -p openapi-typescript@7.13.0 -p typescript@5.9.3` dans `scripts/api-types.sh`, sans entrer dans les dépendances de l'app — pas de conflit de versions — `--legacy-peer-deps` ou rétrograder TypeScript.
- 2026-11-02 — **Icônes : bibliothèque Lucide dans toute l'app, aucun emoji** (demande explicite de l'utilisateur : pas de rendu Twemoji/emoji). `lucide-react-native` + `react-native-svg` 15.16.0, via un composant unique `Icon` ; un test Jest échoue si un emoji apparaît dans `mobile/src` (code ou traductions) — cohérence visuelle et rendu identique iOS/Android — emoji système, autre jeu d'icônes.
- 2026-11-02 — Jest charge la version CommonJS de Lucide (`moduleNameMapper`) car sa version ESM `.mjs` n'est pas transformée — tests simples — ajuster `transformIgnorePatterns` et les transforms `.mjs`.
- 2026-11-03 — Connexion Google via `@react-native-google-signin/google-signin` v17 (API « Original », gratuite) — la doc Expo cite cette bibliothèque et `react-native-nitro-google-signin` ; la première est la plus éprouvée — Nitro (plus récente, moins répandue) ou expo-auth-session.
- 2026-11-03 — Pas de logo Google (Lucide ne fournit pas de logos de marque) : bouton texte « Continuer avec Google » — cohérent avec la règle « Lucide uniquement » — embarquer un SVG de marque.
- 2026-11-03 — Maestro n'est pas exécuté localement (Windows sans simulateur iOS ni émulateur Android installé) ; la cohérence des parcours avec le code est vérifiée par un test Jest sur les `testID` — conforme à la spec (« exécutés si un simulateur est disponible ») — installer un émulateur Android.
