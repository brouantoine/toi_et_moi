# PLAN — Nous Deux

Format : `- [ ] ID — Titre — critère d'acceptation vérifiable — dépend de : …`
Légende : `[ ]` à faire · `[x]` fait · `[!]` bloqué (voir `BLOCKERS.md`).
Règle : prendre la première tâche `[ ]` dont toutes les dépendances sont `[x]`.

## P0 — Bootstrap
- [x] P0.1 — Squelette Django (settings base/dev/test/prod, Celery, ASGI/Channels, health, OpenAPI) — ruff/mypy/pytest/makemigrations verts, `check --deploy` OK avec settings prod — dépend de : —
- [x] P0.2 — Squelette Expo (SDK 58, Expo Router dans `src/app`, `app.config.ts`, brand, tokens + thème clair/sombre, Button/Card/Text/Screen, i18n fr/en) — tsc/eslint/jest/expo-doctor verts — dépend de : —
- [x] P0.3 — Infra et docs (git, `.gitignore`, docker-compose, Makefile, CI, `CLAUDE.md`, fichiers `docs/`) — fichiers présents et cohérents, premier commit — dépend de : P0.1, P0.2

## P1 — Comptes & couple (F1)
- [x] P1.1 — App `accounts` : User personnalisé (login email, prénom, surnom, avatar, date de naissance, langue, fuseau, heures calmes) + admin + factory — AUTH_USER_MODEL défini AVANT toute autre migration, tests modèle verts — dépend de : P0.3
- [ ] P1.2 — Inscription + JWT (register, token, refresh avec rotation/blacklist, logout) — tests : inscription, mauvais mot de passe, refresh blacklisté après rotation, throttling auth — dépend de : P1.1
- [ ] P1.3 — Vérification email + mot de passe oublié (tokens signés, emails fr/en, endpoints) + migration EMAIL_BACKEND→MAILERS (dépréciation Django 6.1) — tests : lien valide/expiré/réutilisé, aucun indice sur l'existence d'un email — dépend de : P1.2
- [ ] P1.4 — Endpoints profil `GET/PATCH /me` (sans avatar) — tests : un utilisateur ne modifie que lui-même, champs validés (fuseau IANA, langue fr/en) — dépend de : P1.2
- [ ] P1.5 — App `couples` : modèles Couple (statuts pending/active/dissolving/dissolved, date de début, devise) et Invitation + services create/join (code 6 caractères sans ambiguïté, expire 48 h, un seul couple actif par utilisateur) — tests services (code expiré, déjà en couple, rejoindre son propre couple) — dépend de : P1.1
- [ ] P1.6 — Mixin unique `CoupleScopedQuerysetMixin` + permissions `IsCoupleMember` / `IsAuthorOnly` dans `core` — tests génériques prouvant le filtrage couple et auteur (partenaire et étranger → 404) — dépend de : P1.5
- [ ] P1.7 — Endpoints couple (créer, rejoindre par code, mon couple, modifier infos) — tests partenaire/étranger, lien `nousdeux://join/CODE` renvoyé — dépend de : P1.6
- [ ] P1.8 — Sign in with Apple côté serveur (vérification JWKS, audience, nonce, cache des clés) — tests avec clés générées et JWKS mocké — dépend de : P1.2
- [ ] P1.9 — Connexion Google côté serveur (vérification ID token, audiences iOS/Android/web) — tests mockés — dépend de : P1.2
- [ ] P1.10 — Client API typé : `make api-types` (drf-spectacular → openapi-typescript) + client `openapi-fetch` + test CI « schéma à jour » — `schema.d.ts` généré, tsc vert — dépend de : P1.7
- [ ] P1.11 — Mobile : socle données (TanStack Query + persistance, Zustand, expo-secure-store, client authentifié avec refresh automatique) — tests du refresh et du logout sur 401 — dépend de : P1.10
- [ ] P1.12 — Design system partie 2 : Input, Avatar, EmptyState, ErrorState, Skeleton, Sheet (a11y, clair/sombre) — tests RNTL de chaque composant — dépend de : P0.2
- [ ] P1.13 — Mobile : écrans inscription, connexion, mot de passe oublié (react-hook-form + zod, i18n) — tests RNTL validation et soumission — dépend de : P1.11, P1.12
- [ ] P1.14 — Mobile : boutons Apple (expo-apple-authentication) et Google (méthode recommandée par la doc Expo) + config plugins — tests : boutons masqués si indisponibles, appel API mocké — dépend de : P1.13, P1.8, P1.9
- [ ] P1.15 — Mobile : formation du couple (créer → code + partage du lien ; rejoindre par code ; deep link `nousdeux://join/CODE`) — tests RNTL + test du parseur de lien — dépend de : P1.13, P1.7
- [ ] P1.16 — Mobile : navigation 5 onglets (Aujourd'hui, Souvenirs, Organisation, Nous, Moi) + garde d'auth/couple + écrans placeholder avec état vide — tests de redirection — dépend de : P1.15
- [ ] P1.17 — Mobile : onboarding 3 écrans (philosophie, ce que l'app ne fera jamais) + drapeau persistant — tests — dépend de : P1.16
- [ ] P1.18 — Mobile : écrans profil et infos du couple (date de début, devise par défaut depuis la locale) — tests — dépend de : P1.16, P1.4
- [ ] P1.19 — Maestro : inscription → création du couple → le partenaire rejoint — fichier YAML cohérent avec les testID — dépend de : P1.17

## P2 — Souvenirs (F2)
- [ ] P2.1 — `core/storage` : URL présignée d'upload (clé préfixée par couple, type et taille validés) + URL signée de lecture à durée limitée — tests avec botocore Stubber — dépend de : P1.6
- [ ] P2.2 — App `memories` : modèles Memory, MemoryPhoto, MemoryReaction, MemoryComment + admin + factories + suppression réelle des fichiers — tests modèles et suppression fichiers — dépend de : P2.1
- [ ] P2.3 — API souvenirs CRUD (chronologique, filtre par type, recherche plein texte Postgres avec repli SQLite) — tests partenaire/étranger + `django_assert_num_queries` — dépend de : P2.2
- [ ] P2.4 — API photos (demande d'upload, confirmation, max 10, suppression) + tâche Celery de miniatures (Pillow) — tests eager — dépend de : P2.3
- [ ] P2.5 — Réaction cœur (toggle, sans compteur) + commentaires courts — tests partenaire/étranger — dépend de : P2.3
- [ ] P2.6 — Endpoint « Il y a N ans aujourd'hui » dans le fuseau de l'utilisateur — tests aux frontières de fuseau et 29 février — dépend de : P2.3
- [ ] P2.7 — Upload avatar et photo de couple via URL présignée — tests — dépend de : P2.1, P1.7
- [ ] P2.8 — Mobile : timeline des souvenirs (liste virtualisée, filtre, recherche) — tests états vide/chargement/erreur — dépend de : P2.3, P1.16
- [ ] P2.9 — Mobile : création/édition de souvenir + sélection photos + compression (2048 px, JPEG 0,8) + upload présigné — tests du service de compression/upload mocké, refus de permission sans crash — dépend de : P2.8, P2.4
- [ ] P2.10 — Mobile : détail souvenir (photos expo-image, cœur, commentaires) — tests — dépend de : P2.9, P2.5
- [ ] P2.11 — Maestro : ajouter un souvenir avec photo — dépend de : P2.10

## P3 — Organisation (F3) + temps réel + hors ligne
- [ ] P3.1 — App `organization` : Event (journée entière, rappel, concerné moi/toi/nous, récurrence annuelle, type retrouvailles) + API — tests partenaire/étranger, occurrences récurrentes — dépend de : P1.6
- [ ] P3.2 — Listes et items (cochables, réordonnables) + API — tests réordonnancement et permissions — dépend de : P1.6
- [ ] P3.3 — Tâches de la maison (assignation, récurrence, échéance, complétion) + vue de répartition neutre de la semaine — tests (aucun score exposé) — dépend de : P1.6
- [ ] P3.4 — Budget : Expense/ExpenseShare (entiers + devise), répartition 50/50 ou personnalisée, solde « qui doit combien », remboursement — tests du calcul et des arrondis — dépend de : P1.6
- [ ] P3.5 — Temps réel : consumer Channels authentifié JWT, groupe par couple, diffusion des changements organisation — tests WebsocketCommunicator (étranger refusé) — dépend de : P3.1, P3.2, P3.3, P3.4
- [ ] P3.6 — Mobile : hors ligne (persistance du cache, file de mutations, mises à jour optimistes, reprise réseau) — tests unitaires des helpers — dépend de : P1.11
- [ ] P3.7 — Mobile : client WebSocket (reconnexion, invalidation de requêtes) — tests — dépend de : P3.5, P3.6
- [ ] P3.8 — Mobile : agenda — tests états vide/chargement/erreur — dépend de : P3.7
- [ ] P3.9 — Mobile : listes (cocher, réordonner, plusieurs listes) — tests — dépend de : P3.7
- [ ] P3.10 — Mobile : tâches + répartition de la semaine — tests — dépend de : P3.7
- [ ] P3.11 — Mobile : budget (dépenses, solde, rembourser) — tests — dépend de : P3.7
- [ ] P3.12 — Maestro : liste de courses partagée — dépend de : P3.9

## P4 — Question du jour & « À retenir » (F4)
- [ ] P4.1 — App `connection` : modèle DailyQuestion (fr/en, catégorie, profondeur) + format de fixture + commande `seed_catalogs` + admin — tests du chargement idempotent — dépend de : P1.6
- [ ] P4.2 — Catalogue questions lot 1 : 75 « légère » fr+en — validation de la fixture par test — dépend de : P4.1
- [ ] P4.3 — Catalogue questions lot 2 : 75 « souvenirs » fr+en — dépend de : P4.1
- [ ] P4.4 — Catalogue questions lot 3 : 75 « rêves » fr+en — dépend de : P4.1
- [ ] P4.5 — Catalogue questions lot 4 : 75 « profonde » fr+en — dépend de : P4.1
- [ ] P4.6 — Catalogue questions lot 5 : 75 « drôle » fr+en — test : total ≥ 365, aucune question dupliquée — dépend de : P4.2, P4.3, P4.4, P4.5
- [ ] P4.7 — Sélection quotidienne par couple (réglage de profondeur), réponse, révélation après sa propre réponse, historique, saut sans pénalité — tests : réponse du partenaire invisible avant la sienne, étranger refusé — dépend de : P4.1
- [ ] P4.8 — PartnerNote « À retenir » (privée à l'auteur, rappel optionnel) + API — tests partenaire/étranger → 404 — dépend de : P1.6
- [ ] P4.9 — Mobile : carte question du jour, réponse, révélation, historique — tests — dépend de : P4.7, P1.16
- [ ] P4.10 — Mobile : écrans « À retenir sur l'autre » — tests — dépend de : P4.8, P1.16
- [ ] P4.11 — Maestro : répondre à la question du jour — dépend de : P4.9

## P5 — Notifications (F9)
- [ ] P5.1 — App `notifications` : PushDevice, NotificationPreference (par type) + API — tests partenaire/étranger — dépend de : P1.4
- [ ] P5.2 — Service d'envoi Expo Push (heures calmes dans le fuseau de chacun, préférences, aucun contenu privé, gestion des tokens invalides) — tests HTTP mockés — dépend de : P5.1
- [ ] P5.3 — Celery Beat : souvenir du jour quotidien à heure locale — tests eager avec horloge figée — dépend de : P5.2, P2.6
- [ ] P5.4 — Rappels : événements, notes « À retenir », tâches — tests — dépend de : P5.2, P3.1, P3.3, P4.8
- [ ] P5.5 — Mobile : enregistrement expo-notifications, canal Android, permission refusée sans crash, écran préférences + heures calmes — tests — dépend de : P5.1, P1.18
- [ ] P5.6 — Mobile : ouverture d'une notification → bon écran — tests du routeur de notifications — dépend de : P5.5

## P6 — Rituels & présence (F6)
- [ ] P6.1 — App `rituals` : CheckIn/CheckInAnswer (3 questions fixes + humeur), jour choisi par le couple, révélation quand les deux ont répondu, historique, rappel hebdo — tests — dépend de : P5.2
- [ ] P6.2 — DateIdea (catalogue + idées du couple), favoris, filtres (budget, durée, maison/dehors, énergie), « Surprends-nous », « Planifier » → Event — tests — dépend de : P3.1, P4.1
- [ ] P6.3 — Catalogue idées lot 1 : 50 idées fr+en — dépend de : P6.2
- [ ] P6.4 — Catalogue idées lot 2 : 50 idées fr+en — dépend de : P6.2
- [ ] P6.5 — Catalogue idées lot 3 : 50 idées fr+en — test : total ≥ 150, filtres tous couverts — dépend de : P6.3, P6.4
- [ ] P6.6 — « Je pense à toi » : endpoint (10/jour, aucun compteur exposé) + push — tests limite et étranger — dépend de : P5.2
- [ ] P6.7 — Distance : heure locale du partenaire + prochaines retrouvailles (endpoint « aujourd'hui » agrégé) — tests — dépend de : P3.1, P1.7
- [ ] P6.8 — Bien-être numérique : résumé hebdo optionnel (tâche) + préférence rappel 20 min — tests — dépend de : P5.2
- [ ] P6.9 — Mobile : écran Aujourd'hui (question, souvenir du jour, événements, « Je pense à toi » + haptique, heure de l'autre, compte à rebours) — tests — dépend de : P6.6, P6.7, P4.9, P2.8
- [ ] P6.10 — Mobile : check-in hebdo — tests — dépend de : P6.1, P1.16
- [ ] P6.11 — Mobile : idées de sorties (filtres, favoris, surprise, planifier) — tests — dépend de : P6.5, P3.8
- [ ] P6.12 — Mobile : rappel doux après 20 min d'utilisation continue (AppState) — tests avec timers factices — dépend de : P6.8
- [ ] P6.13 — Maestro : « je pense à toi » — dépend de : P6.9

## P7 — Rêves & épargne (F7)
- [ ] P7.1 — App `dreams` : Dream (horizon, image), DreamStep + API — tests partenaire/étranger — dépend de : P2.1
- [ ] P7.2 — SavingsGoal + SavingsContribution (entiers + devise, progression) + API — tests — dépend de : P7.1
- [ ] P7.3 — Mobile : rêves et étapes — tests — dépend de : P7.1, P1.16
- [ ] P7.4 — Mobile : épargne — tests — dépend de : P7.2, P7.3

## P8 — Espace privé & moments difficiles (F5)
- [ ] P8.1 — `core` : champ chiffré (MultiFernet, clés par variable d'environnement) + commande de rotation + procédure dans ARCHITECTURE.md — tests chiffrement/rotation, valeur illisible en base — dépend de : P0.3
- [ ] P8.2 — App `private_space` : PrivateJournalEntry chiffrée + API auteur seul — tests partenaire (y compris appel direct par id) et étranger → 404 — dépend de : P8.1, P1.6
- [ ] P8.3 — Endpoint de configuration (`features`) exposant la disponibilité de l'IA + endpoint de reformulation Claude (flag `AI_REFORMULATION_ENABLED`, consentement, rien stocké ni journalisé, masqué sans clé) — tests avec client mocké et vérification qu'aucun log ne contient le texte — dépend de : P1.4
- [ ] P8.4 — PauseRequest (30 min / 1 h / ce soir) : message neutre au partenaire + rappel aux deux à l'échéance — tests — dépend de : P5.2
- [ ] P8.5 — Mobile : journal privé — tests — dépend de : P8.2, P1.16
- [ ] P8.6 — Mobile : « Préparer une conversation » (4 étapes, modèles et reformulations types sans IA, option IA si disponible et consentie) — tests — dépend de : P8.3, P1.16
- [ ] P8.7 — Mobile : flux « Pause » + lien discret vers les ressources d'aide dans les réglages — tests — dépend de : P8.4, P1.18

## P9 — Vie privée, export, séparation, suppression (F8)
- [ ] P9.1 — App `privacy` : DataExport + tâche Celery ZIP (JSON + photos) + lien temporaire + purge — tests (contenu du ZIP, aucun privé du partenaire) — dépend de : P2.4, P8.2
- [ ] P9.2 — Quitter le couple : passage en dissolution (30 jours), notification neutre, purge de l'espace partagé et des fichiers à l'échéance — tests — dépend de : P9.1, P5.2
- [ ] P9.3 — Suppression de compte (privé supprimé immédiatement, couple en dissolution) + API — tests — dépend de : P9.2
- [ ] P9.4 — App `legal` : pages web fr/en (confidentialité, conditions, support, suppression de compte avec formulaire) — tests HTTP 200 dans les deux langues, formulaire de suppression fonctionnel — dépend de : P9.3
- [ ] P9.5 — Mobile : écran « Tes données » + demande d'export — tests — dépend de : P9.1, P1.18
- [ ] P9.6 — Mobile : quitter le couple + supprimer le compte (confirmation calme) — tests — dépend de : P9.3, P1.18
- [ ] P9.7 — Maestro : suppression de compte — dépend de : P9.6

## P10 — Finitions
- [ ] P10.1 — Audit accessibilité (labels, textes dynamiques, contrastes AA via test des tokens, cibles ≥ 44 pt) — dépend de : P9.6
- [ ] P10.2 — Audit mode sombre sur tous les écrans — dépend de : P9.6
- [ ] P10.3 — Audit états vide/chargement/erreur sur tous les écrans — dépend de : P9.6
- [ ] P10.4 — Animations sobres (reanimated, respect de « réduire les animations ») — dépend de : P10.3
- [ ] P10.5 — Performance : listes virtualisées partout, cache d'images, requêtes paginées — dépend de : P10.3
- [ ] P10.6 — Traduction anglaise complète + test de parité des clés + test « aucune chaîne en dur » (règle ESLint) — dépend de : P10.3

## P11 — Préparation stores
- [ ] P11.1 — `app.config.ts` : privacyManifests, ITSAppUsesNonExemptEncryption, supportsTablet false, textes de permission, permissions Android minimales, canal de notification — `npx expo config` vérifié par test — dépend de : P10.6
- [ ] P11.2 — `eas.json` (development, preview, production) + variables par profil + expo-updates — dépend de : P11.1
- [ ] P11.3 — Script assets SVG → PNG (icône 1024, splash, icône adaptative) — PNG générés aux bonnes tailles — dépend de : P11.1
- [ ] P11.4 — Commande `seed_demo` (`make demo`) : 2 utilisateurs en couple, données réalistes, mot de passe via `DEMO_PASSWORD` — tests — dépend de : P9.4, P6.5, P4.6
- [ ] P11.5 — STORE_RELEASE.md : fiches fr+en, sécurité des données Google, notes reviewer Apple, captures à produire — dépend de : P11.4
- [ ] P11.6 — DEPLOY.md complet (VPS/PaaS, Postgres, Redis, S3, HTTPS, Celery, sauvegardes) — dépend de : P11.2
- [ ] P11.7 — ARCHITECTURE.md et HUMAN_TODO.md complets — dépend de : P11.5, P11.6

## P12 — Validation finale (section 8.3)
- [ ] P12.1 — Audit sécurité : test automatique listant chaque route API et vérifiant l'existence de tests partenaire/étranger — dépend de : P11.7
- [ ] P12.2 — Couverture backend ≥ 85 % sur les apps métier — dépend de : P12.1
- [ ] P12.3 — `expo export` ios et android + `expo prebuild --clean` dans un dossier temporaire — dépend de : P11.3
- [ ] P12.4 — Revue des 6 parcours Maestro (exécution si simulateur disponible) — dépend de : P12.3
- [ ] P12.5 — Revue UX finale et audit des anti-fonctionnalités (section 2) — dépend de : P12.4
- [ ] P12.6 — Validation finale complète (8.1 + 8.3) et mise à jour des docs — dépend de : P12.2, P12.5
