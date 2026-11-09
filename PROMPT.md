# PROMPT.md — Boucle de construction de l'app de couple « Nous Deux »

> Ce fichier est relu au début de **chaque** itération. Ne le modifie jamais.

---

## 0. Ton rôle

Tu es l'équipe technique complète (lead mobile, lead backend, designer produit, QA) d'une application de couple **iOS + Android**. Tu travailles **seul et sans surveillance**, en boucle : chaque itération démarre avec une mémoire vide. Ta seule mémoire entre deux itérations, ce sont les fichiers du dépôt (surtout `docs/PLAN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`) et l'historique git.

Personne ne répondra à tes questions. Quand un choix est ambigu, prends l'option la plus simple et la plus sûre, écris-la dans `docs/DECISIONS.md` (date, choix, raison, alternative écartée), et avance.

Tu ne fais jamais : `git push`, déploiement, `eas build`, `eas submit`, création de comptes, saisie de vraies clés. Tout ça va dans `docs/HUMAN_TODO.md`.

---

## 1. Protocole d'une itération (à suivre à la lettre)

1. **S'orienter** : lis ce fichier en entier, puis `docs/PLAN.md`, les ~50 dernières lignes de `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, et `git log --oneline -15`.
2. **Itération zéro** : si `docs/PLAN.md` n'existe pas, ta mission est uniquement : la tâche P0 (section 9) + écrire `docs/PLAN.md`. Découpe toute la spec de ce fichier en tâches atomiques (une tâche = faisable en une itération, environ 1 à 3 h de travail humain), au format :
   `- [ ] P2.3 — Titre — critère d'acceptation vérifiable — dépend de : P2.1`
   Puis commit et termine l'itération.
3. **Choisir** : prends la première tâche `[ ]` dont toutes les dépendances sont `[x]`. Si elle est trop grosse, découpe-la dans `PLAN.md` et prends le premier morceau.
4. **Vérifier avant d'écrire** : cherche dans le code (grep, lecture) si c'est déjà fait en partie. Ne suppose jamais qu'une chose n'existe pas.
5. **Implémenter**, avec ses tests.
6. **Valider** (section 8.1). Tout doit être vert.
7. **Si vert** : coche `[x]` dans `PLAN.md`, ajoute une entrée dans `PROGRESS.md` (date, tâche, fichiers clés, ce qu'un humain doit savoir), puis commit (`feat(mobile): …`, `feat(api): …`, `fix: …`, `test: …`, `chore: …`).
8. **Si bloqué** après 3 tentatives sérieuses : remets le code dans un état qui compile et dont les tests passent (`git restore`/`git stash` si besoin), marque la tâche `[!]` dans `PLAN.md`, décris le blocage dans `BLOCKERS.md` (ce qui a été tenté, erreurs, piste suivante), commit, termine l'itération. Une tâche `[!]` peut être retentée plus tard si une nouvelle piste existe ; si elle exige une action humaine, déplace-la dans `HUMAN_TODO.md`.
9. **Une seule tâche par itération** (ou quelques micro-tâches étroitement liées). Termine ensuite par un résumé de 3 lignes maximum.
10. **Condition de fin** : seulement quand il ne reste aucune tâche `[ ]` ni `[!]` non documentée dans `HUMAN_TODO.md`, ET que la validation finale (section 8.3) passe intégralement, écris exactement :
    `<promise>APP_COMPLETE</promise>`
    N'écris jamais cette balise dans un autre contexte, même pour dire que ce n'est pas fini.

---

## 2. Le produit

### Vision
L'app de couple qui fait **moins regarder son téléphone et plus regarder l'autre**. Le succès se mesure au temps passé ensemble hors écran, pas à l'engagement. Chaque fonctionnalité doit répondre « oui » à : *est-ce que ça rapproche vraiment deux personnes ?*

### Nom et identité
- Nom provisoire : **« Nous Deux »**, centralisé à un seul endroit par côté (`mobile/src/config/brand.ts` + `app.config.ts`, et `BRAND_NAME` dans les settings Django) pour être changé en une minute.
- Bundle ID / package Android : `com.changeme.nousdeux` (placeholder en config, listé dans `HUMAN_TODO.md`).
- Schéma de deep link : `nousdeux://`.
- Langues : **français par défaut** (tutoiement, chaleureux, jamais mièvre, jamais culpabilisant), anglais en seconde langue. Toutes les chaînes passent par l'i18n, aucune chaîne en dur.
- Identité visuelle : chaleureuse et sobre, sans clichés (pas de cœurs roses partout). Palette douce (terracotta, crème, vert sauge, encre), mode sombre complet, typographie très lisible, beaucoup d'espace.

### Règles absolues — anti-fonctionnalités à ne JAMAIS implémenter
- Pas de séries/streaks, de points, de badges, de classements, ni de messages du type « vous n'avez pas répondu depuis X jours ».
- Pas de comparaison avec d'autres couples, pas de « score de couple ».
- Pas de « vu à », pas d'accusés de lecture : **aucune fonction de contrôle**.
- Géolocalisation autorisée (décision de l'utilisateur du 2026-11-09) uniquement pour la **distance entre les deux** : conditions acceptées explicitement par chacun, position lue seulement quand l'app est ouverte (jamais en arrière-plan), désactivable à tout moment, et seule la distance est montrée à l'autre (jamais la position exacte ni une carte).
- Pas de publicité, pas de SDK de tracking ou d'analytics tiers, pas d'App Tracking Transparency.
- Les données privées d'un membre ne sont **jamais** lisibles par l'autre (prouvé par des tests de permission).
- Pas de dark patterns (suppression de compte difficile, notifications insistantes, culpabilisation).

### Navigation (5 onglets)
1. **Aujourd'hui** : question du jour, souvenir du jour (« Il y a 2 ans… »), prochains événements, bouton « Je pense à toi ».
2. **Souvenirs** : journal partagé.
3. **Organisation** : agenda, listes, tâches, budget.
4. **Nous** : check-in hebdo, idées de sorties, rêves et projets.
5. **Moi** : espace privé, « à retenir sur l'autre », réglages, compte, données.

---

## 3. Fonctionnalités (spec)

### F1 — Compte et formation du couple
- Inscription email + mot de passe avec vérification email, mot de passe oublié.
- Connexion Google et **Sign in with Apple** (obligatoire sur l'App Store dès qu'un login tiers existe). Tokens vérifiés côté serveur.
- Profil : prénom, surnom (visible par l'autre), photo, date de naissance optionnelle, langue, fuseau horaire.
- Créer un couple → code d'invitation (6 caractères lisibles, expire après 48 h) + lien d'invitation partageable (deep link `nousdeux://join/CODE`, fallback saisie manuelle). Le partenaire rejoint → couple actif. Un utilisateur = un seul couple actif.
- Infos du couple : date de début (anniversaire), photo de couple, devise (par défaut celle de la locale de l'appareil, modifiable).
- Onboarding de 3 écrans maximum qui explique la philosophie (dont ce que l'app ne fera jamais).

### F2 — Mémoire partagée (Souvenirs)
- Entrée : titre, texte, date, lieu (texte libre, pas de GPS imposé), jusqu'à 10 photos, type (`first_time`, `inside_joke`, `place`, `moment`, `quote`), tags.
- Vue chronologique, filtre par type, recherche plein texte.
- « Il y a N ans aujourd'hui » : carte sur l'écran Aujourd'hui + notification push quotidienne optionnelle (Celery Beat, respecte les heures calmes et le fuseau de chacun).
- Réaction unique et douce (un cœur, sans compteur), commentaires courts.
- Photos : compression côté client (max 2048 px, JPEG ~0,8), upload direct vers stockage S3-compatible via URL présignée, miniatures générées côté serveur (Celery), images servies via URLs signées à durée limitée.

### F3 — Organisation (charge mentale partagée)
- **Agenda partagé** : événements (titre, date/heure ou journée entière, lieu, rappel, concerné : moi / toi / nous), anniversaires récurrents (y compris famille et belle-famille), type spécial « retrouvailles ».
- **Listes** (courses et listes libres) : plusieurs listes, items cochables, réordonnables.
- **Tâches de la maison** : assignée à moi / toi / nous, récurrence (quotidienne, hebdo, mensuelle), échéance. Vue « qui porte quoi cette semaine » sous forme de répartition neutre. Jamais de score, jamais de « tu en as fait moins ».
- **Budget partagé** : dépenses communes (montant, qui a payé, répartition 50/50 ou personnalisée, catégorie), solde simplifié « qui doit combien », remboursement en un geste. Aucune liaison bancaire.
- **Temps réel** entre les deux téléphones (WebSocket via Django Channels) + **hors ligne** avec mises à jour optimistes et resynchronisation.

### F4 — Se connaître encore
- **Question du jour** : catalogue d'au moins 365 questions (fr + en) en catégories (légère, souvenirs, rêves, profonde, drôle), avec un réglage de « profondeur » par couple. Chacun répond ; la réponse de l'autre n'est révélée qu'après avoir répondu soi-même. Aucune pénalité si on saute. Historique des réponses à deux.
- **« À retenir sur l'autre »** (privé à l'auteur) : petites notes (« veut voir ce film », « aime un message avant une grosse journée »), rappel optionnel à une date.
- Les questions sont livrées en fixtures JSON rédigées par toi : variées, sincères, non clichées, adaptées à des couples de tous âges et toutes cultures.

### F5 — Moments difficiles (espace privé et aide à la communication)
- **Journal privé** : visible uniquement par son auteur, chiffré au repos (chiffrement au niveau du champ côté serveur, clé fournie par variable d'environnement, procédure de rotation documentée). Tests prouvant que le partenaire n'y accède jamais, y compris par appel direct à l'API.
- **« Préparer une conversation »** : guide en étapes (ce qui s'est passé, ce que je ressens, ce dont j'ai besoin, ce que je propose) qui aide à passer de « tu ne fais jamais… » à « j'ai besoin de… ». Fonctionne entièrement sans IA (modèles, exemples, reformulations types).
- **Option IA** (désactivée par défaut, consentement explicite, feature flag serveur `AI_REFORMULATION_ENABLED`) : proposition de reformulation via l'API Claude, appelée depuis le backend uniquement. Le texte n'est jamais stocké ni journalisé. Sans clé API, l'option est masquée.
- **« Pause »** : un partenaire signale « j'ai besoin d'une pause, on en reparle dans 30 min / 1 h / ce soir ». L'autre reçoit un message neutre et bienveillant ; rappel aux deux à l'échéance.
- L'app ne prend jamais parti, ne juge jamais, ne transmet jamais un contenu privé.
- Dans les réglages, un lien discret vers des ressources d'aide (texte générique invitant à contacter un professionnel ou les services d'urgence locaux ; pas de numéros codés en dur).

### F6 — Rituels et présence
- **Check-in hebdomadaire** (10 min) le jour choisi par le couple : 3 questions fixes (qu'est-ce qui a été bien, qu'est-ce qui a manqué, de quoi j'ai besoin cette semaine) + humeur sur une échelle douce. Réponses révélées quand les deux ont répondu. Historique consultable.
- **Idées de sorties** : catalogue d'au moins 150 idées (fixtures fr + en) filtrables par budget (gratuit / € / €€ / €€€), durée, maison / dehors, niveau d'énergie ; favoris ; bouton « Surprends-nous » ; idées personnelles du couple. Bouton « Planifier » qui crée l'événement dans l'agenda.
- **« Je pense à toi »** : un tap → notification push + vibration (haptique) chez l'autre. Limité (10 par jour), aucun compteur affiché, aucune obligation de répondre.
- **Couples à distance** : heure locale de l'autre visible, compte à rebours jusqu'aux prochaines « retrouvailles ».
- **Bien-être numérique** : heures calmes (aucune notification), résumé hebdomadaire optionnel qui encourage un moment hors écran, rappel doux optionnel après 20 min d'utilisation continue.

### F7 — Rêves et projets
- Rêves communs (voyage, maison, enfants, projet pro…) : description, image, horizon (cette année, d'ici 3 ans, un jour), étapes cochables.
- Objectif d'épargne optionnel : montant cible, contributions (qui, combien, quand), progression. Aucune liaison bancaire.

### F8 — Vie privée, export, séparation, suppression
- Écran **« Tes données »** : ce qui est stocké, ce que voit l'autre, ce qu'il ne voit jamais.
- **Export complet** (ZIP : JSON + photos) généré en tâche de fond, lien de téléchargement temporaire.
- **Quitter le couple** (« sortie digne ») : confirmation calme ; chacun a 30 jours pour exporter l'espace partagé, puis l'espace partagé et ses fichiers sont supprimés. Les espaces privés restent à chacun. Notification au partenaire, au ton neutre et respectueux.
- **Suppression de compte dans l'app** (exigée par Apple et Google) + **page web de suppression** (exigée par Google Play). Privé supprimé immédiatement ; si l'utilisateur était en couple, le couple passe en dissolution (le partenaire garde 30 jours pour exporter).
- **Pages web servies par Django** (fr + en) : politique de confidentialité, conditions d'utilisation, suppression de compte, support. Textes rédigés par toi, marqués « à faire relire par un juriste » dans `HUMAN_TODO.md`.

### F9 — Notifications
- Expo Push Notifications. Préférences par type (souvenir du jour, question, check-in, « je pense à toi », pause, organisation).
- Heures calmes appliquées côté serveur, selon le fuseau de chaque utilisateur.
- Textes jamais culpabilisants, jamais intrusifs (aucun contenu privé dans une notification).

---

## 4. Stack technique (décidée — ne change rien sans raison écrite dans `DECISIONS.md`)

### Mobile — `mobile/`
- **React Native + Expo** (dernier SDK stable), **TypeScript strict**, **Expo Router**.
- **Continuous Native Generation** : les dossiers `ios/` et `android/` ne sont pas commités ; tout passe par `app.config.ts` et des config plugins.
- **EAS Build / EAS Submit** configurés pour iOS et Android (`eas.json`), ce qui permet de builder l'iOS dans le cloud sans Mac.
- État serveur : TanStack Query avec persistance hors ligne. État local : Zustand. Formulaires : react-hook-form + zod.
- i18n : i18next + expo-localization (fr par défaut, en).
- Modules : expo-notifications, expo-secure-store (tokens), expo-image-picker, expo-image-manipulator, expo-image, expo-haptics, expo-apple-authentication, connexion Google via la méthode recommandée par la doc Expo au moment de l'implémentation, expo-linking, expo-updates, react-native-reanimated (animations sobres).
- **Design system maison** dans `mobile/src/ui/` : tokens (couleurs, espacements, typos, rayons), Button, Card, Input, Sheet, Avatar, EmptyState, ErrorState, Skeleton… Mode clair/sombre. Accessibilité : labels lecteur d'écran, tailles de texte dynamiques, contrastes AA, cibles ≥ 44 pt.
- **Client API typé généré** depuis le schéma OpenAPI du backend (openapi-typescript). Jamais de types d'API écrits à la main.
- Logique métier dans des hooks/services, pas dans les écrans.
- Tests : Jest + React Native Testing Library ; parcours E2E **Maestro** dans `mobile/.maestro/`.
- Qualité : ESLint + Prettier.

### Backend — `backend/`
- Python 3.12+, **Django** (dernière version stable) + **Django REST Framework**, drf-spectacular (OpenAPI).
- **PostgreSQL**, **Redis**, **Celery + Celery Beat** (souvenir du jour, rappels, check-ins, exports, purges, miniatures), **Django Channels** (WebSocket), serveur ASGI.
- Auth : JWT (djangorestframework-simplejwt, rotation et blacklist des refresh tokens), vérification serveur des identity tokens Apple et Google.
- Fichiers : django-storages, S3-compatible (MinIO en local), URLs présignées.
- Chiffrement de champs pour tout ce qui est privé.
- Sécurité : permissions objet strictes via **un mixin unique et testé** qui filtre tout queryset par le couple de l'utilisateur (et par auteur pour le privé) ; rate limiting DRF ; CORS strict ; en-têtes de sécurité ; settings prod durcis ; aucun secret dans le dépôt (`.env.example` uniquement).
- Tests : pytest + pytest-django + factory_boy. Couverture ≥ 85 % sur les apps métier. Pour **chaque endpoint** : test « le partenaire ne peut pas » (quand c'est privé) et « un étranger au couple ne peut pas ».
- Tests exécutables sans Docker : Postgres si `DATABASE_URL` est défini, sinon SQLite ; Celery en mode eager ; channel layer en mémoire.
- Qualité : ruff (lint + format), mypy.
- Admin Django pour gérer les catalogues (questions, idées).

### Infra — racine du dépôt
- `docker-compose.yml` : postgres, redis, minio, backend (ASGI), celery worker, celery beat.
- `backend/Dockerfile` prêt pour la production.
- CI GitHub Actions (`.github/workflows/`) : lint, typecheck, tests backend et mobile.
- `Makefile` : `make up`, `make test`, `make lint`, `make seed`, `make api-types`, `make demo`.

### Structure du dépôt
```
/PROMPT.md                 ce fichier — ne pas modifier
/CLAUDE.md                 conventions et commandes, court (créé en P0)
/loop.sh                   script de boucle — ne pas modifier
/docs/
   PLAN.md  PROGRESS.md  DECISIONS.md  BLOCKERS.md  HUMAN_TODO.md
   ARCHITECTURE.md  DEPLOY.md  STORE_RELEASE.md
/backend/                  apps : accounts, couples, memories, organization,
                           connection, rituals, dreams, private_space,
                           privacy, notifications, legal
/mobile/
/docker-compose.yml  /Makefile  /.github/workflows/
```

---

## 5. Modèle de données (point de départ, ajustable avec trace dans `DECISIONS.md`)

- `User` (email, prénom, surnom, avatar, langue, fuseau, heures calmes)
- `Couple` (2 membres, date de début, devise, statut `pending | active | dissolving | dissolved`, date de dissolution), `Invitation` (code, expire_at)
- `Memory`, `MemoryPhoto`, `MemoryReaction`, `MemoryComment`
- `Event`, `List`, `ListItem`, `Chore`, `Expense`, `ExpenseShare`
- `DailyQuestion` (catalogue), `QuestionAnswer`
- `PartnerNote` (privé auteur), `PrivateJournalEntry` (privé, chiffré)
- `PauseRequest`, `CheckIn`, `CheckInAnswer`
- `DateIdea` (catalogue + idées du couple), `DateIdeaFavorite`
- `ThinkingOfYou` (horodatage uniquement, rate-limité)
- `Dream`, `DreamStep`, `SavingsGoal`, `SavingsContribution`
- `PushDevice`, `NotificationPreference`, `DataExport`

Règles : toute entité partagée porte `couple_id` ; montants en entiers (plus petite unité de la devise) + code devise ; dates stockées en UTC, affichées dans le fuseau de l'utilisateur ; suppression réelle des fichiers associés quand une entité est supprimée.

---

## 6. Exigences stores (à intégrer dans le code, pas seulement documenter)

**Communes**
- Suppression de compte dans l'app ; politique de confidentialité accessible dans l'app et sur le web.
- Textes de permission clairs (photos, caméra, notifications) ; aucun crash si une permission est refusée.
- Compte de démonstration seedé (`make demo`) : 2 utilisateurs déjà en couple avec des données réalistes, pour les reviewers. Identifiants documentés dans `STORE_RELEASE.md`, mot de passe lu depuis une variable d'environnement.

**iOS**
- Sign in with Apple.
- Manifeste de confidentialité via `ios.privacyManifests` dans `app.config.ts`.
- `ITSAppUsesNonExemptEncryption` déclaré correctement.
- Aucun tracking, donc pas d'ATT.
- iPhone uniquement par défaut (`supportsTablet: false`, sauf décision contraire documentée).

**Android**
- Page web de suppression de compte.
- Permissions minimales, icône adaptative, canal de notification configuré.
- Réponses au formulaire « Sécurité des données » rédigées dans `STORE_RELEASE.md`.

**EAS**
- `eas.json` avec profils `development`, `preview` (APK interne / build TestFlight), `production` (AAB + IPA).
- Variables d'environnement par profil (`EXPO_PUBLIC_API_URL`, etc.), `expo-updates` configuré.

**Assets**
- Icône 1024×1024, splash, icône adaptative Android : génère des versions provisoires propres (SVG → PNG par script), listées « à remplacer par un designer » dans `HUMAN_TODO.md`.

**Fiches stores** (dans `STORE_RELEASE.md`, fr + en)
- Nom, sous-titre, description courte et longue, mots-clés, catégorie, classification d'âge suggérée, notes pour le reviewer Apple, liste des captures d'écran à produire et des écrans à montrer.

---

## 7. Réservé aux humains → `docs/HUMAN_TODO.md`

Tu ne fais pas ces actions : tu les prépares et tu les documentes pas à pas, commandes exactes incluses.
- Comptes Apple Developer et Google Play Console, création des fiches apps.
- `eas login`, `eas init`, identifiants de signature (gérés par EAS), `eas build`, `eas submit`.
- Credentials push : clé APNs (via EAS) et fichier Firebase pour Android.
- Nom définitif, bundle ID définitif, domaine, email de support, liens universels (Associated Domains / App Links).
- Déploiement du backend (VPS ou PaaS au choix) + Postgres + Redis + stockage S3 + HTTPS — guide complet dans `DEPLOY.md`.
- Clés : Google OAuth (iOS / Android / web), Apple Sign In, clé API Claude (optionnelle), stockage S3.
- Relecture juridique des pages légales.
- Captures d'écran des stores, tests sur vrais appareils, test fermé Google Play si le compte l'exige.

---

## 8. Validation

### 8.1 À chaque itération (sur ce que tu as touché, et rien de cassé ailleurs)
**Backend** : `ruff check`, `ruff format --check`, `mypy`, `pytest`, `python manage.py makemigrations --check --dry-run`.
**Mobile** : `npx tsc --noEmit`, `npx eslint .`, `npx jest`, `npx expo-doctor`.
Si le schéma d'API change : `make api-types`, puis `tsc` doit passer.

### 8.2 Règles
- Ne désactive, ne supprime, ne skippe jamais un test pour faire passer la validation. Corrige le code.
- Si un outil manque, installe-le (pip / npm). Si quelque chose d'externe est indisponible (Docker, simulateur), adapte-toi (fallbacks prévus en section 4) et note-le dans `DECISIONS.md`.
- Ne commite jamais de secrets, de `.env`, de `node_modules`, ni de dossiers `ios/` / `android/` générés.

### 8.3 Validation finale (avant `APP_COMPLETE`)
- Suites backend et mobile entièrement vertes ; couverture backend ≥ 85 %.
- `python manage.py check --deploy` sans erreur avec les settings de production (variables factices).
- `npx expo export --platform ios` et `npx expo export --platform android` réussissent.
- `npx expo prebuild --clean` réussit dans un dossier temporaire (sans commiter le résultat).
- Parcours Maestro écrits et cohérents pour : inscription → création du couple → le partenaire rejoint ; ajouter un souvenir avec photo ; répondre à la question du jour ; liste de courses partagée ; « je pense à toi » ; suppression de compte. Exécutés si un simulateur est disponible.
- Audit sécurité : chaque endpoint a ses tests « partenaire » et « étranger ».
- Revue UX : chaque écran a un état vide bienveillant, un état de chargement, un état d'erreur ; aucun texte en dur ; mode sombre correct ; aucune anti-fonctionnalité de la section 2.
- `make demo` fonctionne.
- `docs/ARCHITECTURE.md`, `DEPLOY.md`, `STORE_RELEASE.md`, `HUMAN_TODO.md` complets et à jour.

---

## 9. Ordre de construction (phases à décliner dans `PLAN.md`)

- **P0 Bootstrap** : git, structure, `.gitignore`, `CLAUDE.md`, docker-compose, Makefile, squelette Django (settings base / dev / test / prod via variables d'environnement), squelette Expo (Expo Router, design system minimal, i18n, thème clair/sombre), CI, fichiers `docs/`.
- **P1 Comptes & couple** (F1) + client API typé + navigation 5 onglets + onboarding.
- **P2 Souvenirs** (F2) + upload photos.
- **P3 Organisation** (F3) + temps réel + hors ligne.
- **P4 Question du jour & « À retenir »** (F4) + catalogue de questions (en plusieurs tâches).
- **P5 Notifications** (F9) + souvenir du jour + heures calmes.
- **P6 Rituels & présence** (F6) + catalogue d'idées (en plusieurs tâches).
- **P7 Rêves & épargne** (F7).
- **P8 Espace privé & moments difficiles** (F5).
- **P9 Vie privée, export, séparation, suppression, pages légales** (F8).
- **P10 Finitions** : accessibilité, mode sombre, états vides / chargement / erreur, animations sobres, performance (listes virtualisées, cache d'images), traduction anglaise complète.
- **P11 Préparation stores** (section 6) + données de démo + documentation finale.
- **P12 Validation finale** (section 8.3) et correction de tout ce qui n'est pas conforme.

---

## 10. Conventions

- Code, noms, commits : anglais. Interface : français + anglais. Documentation : français.
- Petits fichiers, composants découpés, pas de logique métier dans les écrans.
- Backend : une app Django par domaine ; logique métier dans des services ; serializers fins ; pas de requêtes N+1 (`select_related` / `prefetch_related`, tests `django_assert_num_queries` sur les listes principales).
- Ajoute une dépendance seulement si elle est justifiée ; préfère les modules Expo officiels.
- Garde `CLAUDE.md` court et à jour (commandes, conventions, pièges connus).
