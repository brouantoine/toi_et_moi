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
- [x] P1.2 — Inscription + JWT (register, token, refresh avec rotation/blacklist, logout) — tests : inscription, mauvais mot de passe, refresh blacklisté après rotation, throttling auth — dépend de : P1.1
- [x] P1.3 — Vérification email + mot de passe oublié (tokens signés, emails fr/en, endpoints) + migration EMAIL_BACKEND→MAILERS (dépréciation Django 6.1) — tests : lien valide/expiré/réutilisé, aucun indice sur l'existence d'un email — dépend de : P1.2
- [x] P1.4 — Endpoints profil `GET/PATCH /me` (sans avatar) — tests : un utilisateur ne modifie que lui-même, champs validés (fuseau IANA, langue fr/en) — dépend de : P1.2
- [x] P1.5 — App `couples` : modèles Couple (statuts pending/active/dissolving/dissolved, date de début, devise) et Invitation + services create/join (code 6 caractères sans ambiguïté, expire 48 h, un seul couple actif par utilisateur) — tests services (code expiré, déjà en couple, rejoindre son propre couple) — dépend de : P1.1
- [x] P1.6 — Mixin unique `CoupleScopedQuerysetMixin` + permissions `IsCoupleMember` / `IsAuthorOnly` dans `core` — tests génériques prouvant le filtrage couple et auteur (partenaire et étranger → 404) — dépend de : P1.5
- [x] P1.7 — Endpoints couple (créer, rejoindre par code, mon couple, modifier infos) — tests partenaire/étranger, lien `nousdeux://join/CODE` renvoyé — dépend de : P1.6
- [x] P1.8 — Sign in with Apple côté serveur (vérification JWKS, audience, nonce, cache des clés) — tests avec clés générées et JWKS mocké — dépend de : P1.2
- [x] P1.9 — Connexion Google côté serveur (vérification ID token, audiences iOS/Android/web) — tests mockés — dépend de : P1.2
- [x] P1.10 — Client API typé : `make api-types` (drf-spectacular → openapi-typescript) + client `openapi-fetch` + test CI « schéma à jour » — `schema.d.ts` généré, tsc vert — dépend de : P1.7
- [x] P1.11 — Mobile : socle données (TanStack Query + persistance, Zustand, expo-secure-store, client authentifié avec refresh automatique) — tests du refresh et du logout sur 401 — dépend de : P1.10
- [x] P1.12a — Icônes Lucide (demande utilisateur) : composant `Icon` unique (lucide-react-native + react-native-svg), test interdisant tout emoji dans `src/` — tests verts — dépend de : P0.2
- [x] P1.12 — Design system partie 2 : Input, Avatar, EmptyState, ErrorState, Skeleton, Sheet (a11y, clair/sombre) — tests RNTL de chaque composant — dépend de : P0.2
- [x] P1.13 — Mobile : écrans inscription, connexion, mot de passe oublié (react-hook-form + zod, i18n) — tests RNTL validation et soumission — dépend de : P1.11, P1.12
- [x] P1.14 — Mobile : boutons Apple (expo-apple-authentication) et Google (méthode recommandée par la doc Expo) + config plugins — tests : boutons masqués si indisponibles, appel API mocké — dépend de : P1.13, P1.8, P1.9
- [x] P1.15 — Mobile : formation du couple (créer → code + partage du lien ; rejoindre par code ; deep link `nousdeux://join/CODE`) — tests RNTL + test du parseur de lien — dépend de : P1.13, P1.7
- [x] P1.16 — Mobile : navigation 5 onglets (Aujourd'hui, Souvenirs, Organisation, Nous, Moi) + garde d'auth/couple + écrans placeholder avec état vide — tests de redirection — dépend de : P1.15
- [x] P1.17 — Mobile : onboarding 3 écrans (philosophie, ce que l'app ne fera jamais) + drapeau persistant — tests — dépend de : P1.16
- [x] P1.18 — Mobile : écrans profil et infos du couple (date de début, devise par défaut depuis la locale) — tests — dépend de : P1.16, P1.4
- [x] P1.19 — Maestro : inscription → création du couple → le partenaire rejoint — fichier YAML cohérent avec les testID — dépend de : P1.17

## P2 — Souvenirs (F2)
- [x] P2.1 — `core/storage` : URL présignée d'upload (clé préfixée par couple, type et taille validés) + URL signée de lecture à durée limitée — tests avec botocore Stubber — dépend de : P1.6
- [x] P2.2 — App `memories` : modèles Memory, MemoryPhoto, MemoryReaction, MemoryComment + admin + factories + suppression réelle des fichiers — tests modèles et suppression fichiers — dépend de : P2.1
- [x] P2.3 — API souvenirs CRUD (chronologique, filtre par type, recherche plein texte Postgres avec repli SQLite) — tests partenaire/étranger + `django_assert_num_queries` — dépend de : P2.2
- [x] P2.4 — API photos (demande d'upload, confirmation, max 10, suppression) + tâche Celery de miniatures (Pillow) — tests eager — dépend de : P2.3
- [x] P2.5 — Réaction cœur (toggle, sans compteur) + commentaires courts — tests partenaire/étranger — dépend de : P2.3
- [x] P2.6 — Endpoint « Il y a N ans aujourd'hui » dans le fuseau de l'utilisateur — tests aux frontières de fuseau et 29 février — dépend de : P2.3
- [x] P2.7 — Upload avatar et photo de couple via URL présignée — tests — dépend de : P2.1, P1.7
- [x] P2.8 — Mobile : timeline des souvenirs (liste virtualisée, filtre, recherche) — tests états vide/chargement/erreur — dépend de : P2.3, P1.16
- [x] P2.9 — Mobile : création/édition de souvenir + sélection photos + compression (2048 px, JPEG 0,8) + upload présigné — tests du service de compression/upload mocké, refus de permission sans crash — dépend de : P2.8, P2.4
- [x] P2.10 — Mobile : détail souvenir (photos expo-image, cœur, commentaires) — tests — dépend de : P2.9, P2.5
- [x] P2.11 — Maestro : ajouter un souvenir avec photo — dépend de : P2.10

## P3 — Organisation (F3) + temps réel + hors ligne
- [x] P3.1 — App `organization` : Event (journée entière, rappel, concerné moi/toi/nous, récurrence annuelle, type retrouvailles) + API — tests partenaire/étranger, occurrences récurrentes — dépend de : P1.6
- [x] P3.2 — Listes et items (cochables, réordonnables) + API — tests réordonnancement et permissions — dépend de : P1.6
- [x] P3.3 — Tâches de la maison (assignation, récurrence, échéance, complétion) + vue de répartition neutre de la semaine — tests (aucun score exposé) — dépend de : P1.6
- [x] P3.4 — Budget : Expense/ExpenseShare (entiers + devise), répartition 50/50 ou personnalisée, solde « qui doit combien », remboursement — tests du calcul et des arrondis — dépend de : P1.6
- [x] P3.5 — Temps réel : consumer Channels authentifié JWT, groupe par couple, diffusion des changements organisation — tests WebsocketCommunicator (étranger refusé) — dépend de : P3.1, P3.2, P3.3, P3.4
- [x] P3.6 — Mobile : hors ligne (persistance du cache, file de mutations, mises à jour optimistes, reprise réseau) — tests unitaires des helpers — dépend de : P1.11
- [x] P3.7 — Mobile : client WebSocket (reconnexion, invalidation de requêtes) — tests — dépend de : P3.5, P3.6
- [x] P3.8 — Mobile : agenda — tests états vide/chargement/erreur — dépend de : P3.7
- [x] P3.9 — Mobile : listes (cocher, réordonner, plusieurs listes) — tests — dépend de : P3.7
- [x] P3.10 — Mobile : tâches + répartition de la semaine — tests — dépend de : P3.7
- [x] P3.11 — Mobile : budget (dépenses, solde, rembourser) — tests — dépend de : P3.7
- [x] P3.12 — Maestro : liste de courses partagée — dépend de : P3.9

## PV — App plus vivante (demande de l'utilisateur, avant P4)
- [x] PV.1 — Accueil vivant : en-tête du couple (photo ou avatars, « Antoine & Sam », « ensemble depuis N jours », prochain jalon), météo du matin, prochain moment de l'agenda, « il y a N ans » (souvenir du jour), en cartes colorées — tests des calculs de jalons et des états — dépend de : P6.15c, P3.8, P2.6
- [x] PV.2 — Animations et célébrations : cœur animé, petite célébration (jalon, réponse de l'autre), entrées de cartes et transitions douces, haptique ; tout coupé si « réduire les animations » — tests — dépend de : PV.1
- [x] PV.3 — Messages (API) : fil privé du couple (texte, photo, note vocale par upload présigné), pagination, suppression de ses messages, notification au partenaire ; jamais d'accusé de lecture, de « en train d'écrire » ni de statut en ligne — tests partenaire/étranger — dépend de : P2.1, P5.2
- [x] PV.4 — Messages (mobile) : fil, envoi texte/photo, enregistrement et lecture de notes vocales (expo-audio), temps réel, hors ligne — tests — dépend de : PV.3, P3.7
- [x] PV.5 — Invitation facile : bouton unique « Inviter ta moitié » (crée l'espace et ouvre le partage), copier le code, QR code à scanner, lien HTTPS `PUBLIC_WEB_URL/join/CODE` avec page d'accueil Django (code en grand, liens stores, « ouvrir l'app »), fichiers apple-app-site-association / assetlinks (identifiants dans HUMAN_TODO) ; côté invité : « Coller le code » depuis le presse-papiers, le code reçu par lien survit à l'inscription — tests — dépend de : P1.5

## PX — Refonte blanche et nouveautés (demande du 2026-11-09, à faire en premier)
Inspiration : capture d'une app de couple fournie par l'utilisateur (avatars reliés par la distance, cartes d'activités pastel, barre d'onglets flottante) — on reprend l'esprit, pas la marque ni les séries (🔥 exclues).
- [x] PX.1 — Thème blanc dominant façon Apple Music : fond blanc, surfaces gris très clair, grands titres, accent unique ; mode sombre conservé — tests de contraste — dépend de : P0
- [x] PX.2 — Couleur du couple : choix de l'accent dans Réglages parmi une palette vérifiée (contraste AA), enregistrée sur le couple et appliquée chez les deux en temps réel — API + mobile + tests — dépend de : PX.1
- [ ] PX.3 — Illustrations 3D (Fluent Emoji 3D, licence MIT) pour cartes, humeurs et activités ; Lucide reste pour les contrôles — test de licence/attribution — dépend de : PX.1
- [x] PX.4b — Barre d'onglets flottante comme sur la capture : pilule blanche translucide, icônes seules (maison, cartes empilées, cœur, cloche, profil), onglet actif sur fond gris doux, libellés pour l'accessibilité — tests
- [ ] PX.4 — Accueil façon capture : vos deux avatars reliés par une ligne pointillée avec la distance (cadenas tant que les deux n'ont pas partagé, réglage depuis là ; reprend PW.5 mobile), bulle « Quoi de neuf ? » = météo du matin, « Activités du jour » en cartes pastel illustrées, barre d'onglets flottante — tests — dépend de : PX.3, PW.5
- [ ] PX.5 — Galerie partagée : toutes les photos (souvenirs, messages) classées par mois, grille, visionneuse, ajout direct — API + mobile + tests partenaire/étranger — dépend de : P2.6, PV.4
- [ ] PX.6 — Messagerie complète (remplacer WhatsApp) : répondre à un message (citation), réactions (PW.1), modifier, supprimer pour les deux, vidéos, fichiers, aperçu des liens, recherche, messages épinglés, fond d'écran du couple ; appels avec PW.17 ; toujours sans « vu », « en train d'écrire » ni « en ligne » (règle absolue) — tests — dépend de : PV.4
- [ ] PX.7 — IA du couple, conversation partagée : un seul fil visible par les deux, l'agent (API Claude côté backend) répond uniquement dans ce fil commun (aucun échange privé avec l'un ou l'autre), écoute les deux camps, donne son avis et des conseils, propose des idées (sorties, rituels, cartes) et peut, après confirmation, ajouter à l'agenda ou aux listes ; activation par les deux, messages chiffrés, suppression à tout moment, détection des situations de danger → ressources d'aide (P8) ; Premium — tests consentement, étranger — dépend de : PV.4, P9b
- [ ] PX.8 — Widget « jours ensemble » sur l'écran verrouillé, exactement comme sur la capture de l'utilisateur (petit widget rond : icône de bague au-dessus du nombre, « 99 jours ») + versions écran d'accueil ; iOS WidgetKit (accessoryCircular / inline / rectangulaire) via cible Swift, date de début partagée par App Group, le widget calcule lui-même le nombre de jours chaque nuit ; Android : widget d'écran d'accueil (pas d'écran verrouillé sur téléphone) ; icône bague dessinée (même trait que Lucide) aussi utilisée dans l'app à la place du cœur pour le compteur — build de développement requis (pas Expo Go) — dépend de : PX.1
- [x] PW.5 mobile — réglage « ma ville / partager la distance » (recherche de ville) et affichage dans l'en-tête de l'accueil (PX.4)

## PW — Plus vivante, suite (benchmark de 27 apps de couple, choix de l'utilisateur)
Ordre : PW.1–PW.13 avant P4 ; PW.14–PW.18 demandent un build de développement (après P6). Règles inchangées : ni séries, ni points, ni classement, ni position GPS.
- [ ] PW.1 — Réactions aux messages : 6 réactions en icônes Lucide (une par personne et par message, remplaçable), temps réel — API + mobile + tests partenaire/étranger — dépend de : PV.4
- [ ] PW.2 — « Je pense à toi » et toucher à distance (reprend P6.6) : appui → push + vibration « battement de cœur » chez l'autre, 10/jour sans compteur visible — tests — dépend de : P5.2
- [ ] PW.3 — Roue du hasard : roues prêtes (qui cuisine, quelle sortie, quel film) et roues du couple, rotation animée (fondu si animations réduites), résultat partageable dans les messages — tests — dépend de : PV.4
- [ ] PW.4 — Comptes à rebours : marquer un moment de l'agenda « compte à rebours », cartes « J-12 » sur l'accueil (dont les retrouvailles) — tests — dépend de : P3.8
- [x] PW.5 — Distance par géolocalisation (API ville faite : bf984c0, à remplacer) : écran de conditions à accepter par chacun (version enregistrée), position lue avec expo-location quand l'app est ouverte (jamais en arrière-plan), envoyée au backend, distance précise calculée côté serveur et arrondie ; l'autre ne voit que la distance (et la ville, déduite de l'index hors ligne) ; désactivation et effacement immédiats — tests : rien sans double consentement, coordonnées jamais renvoyées — dépend de : P1.16
- [ ] PW.6 — Bocal de gratitude : un merci par jour, caché jusqu'au dimanche, révélation commune animée — tests confidentialité avant révélation — dépend de : P5.2
- [ ] PW.7 — Défis doux de la semaine : un défi à deux par semaine (catalogue fr+en), « fait » ensemble, aucun point — tests — dépend de : P4.1
- [ ] PW.8 — Rituels guidés : bibliothèque (baiser de 6 s, merci du soir, marche sans téléphone…) avec minuteur et rappel optionnel — tests — dépend de : P5.2
- [ ] PW.9 — Plus de paquets de cartes thématiques + favoris (étend P4.19) — catalogue validé par test — dépend de : P4.19
- [ ] PW.10 — Liste d'envies et cadeaux : envies partagées, idées cadeaux cachées à l'autre (notes privées), lien et prix optionnels — tests : une idée cadeau n'est jamais visible par l'autre — dépend de : P3.4
- [ ] PW.11 — Plante du couple : grandit avec les moments partagés (souvenirs, réponses, rituels), ne fane jamais, sans compteur — tests — dépend de : P4.9
- [ ] PW.12 — Parcours de 7 jours (s'écouter, après une dispute, retrouver du temps à deux) : une étape par jour, progression privée au couple ; certains parcours Premium — tests — dépend de : P4.1, P9b
- [ ] PW.13 — Positions : catalogue de positions en dessins au trait originaux (SVG sobres) avec leur nom et une description non vulgaire ; visible seulement si les deux activent le réglage intimité (P4.16), 17+ ; « à essayer » en mode envies communes (seuls les accords sont révélés) — tests confidentialité — dépend de : P4.16
- [ ] PW.14 — Synchronisation des agendas de l'appareil (Google, Apple, Outlook via expo-calendar, lecture seule, opt-in) : ses propres créneaux visibles dans son agenda, rien n'est partagé sans choix explicite — tests — dépend de : P3.8
- [ ] PW.15 — Widgets écran d'accueil (étend P6.17) : « ensemble depuis N jours », photo prise sur le vif qui apparaît chez l'autre (façon Locket), humeur du matin — dépend de : P6.17
- [ ] PW.16 — Coach IA (fusionné dans PX.7) (Premium, désactivé par défaut, consentement explicite) : conseils via l'API Claude côté backend, textes jamais stockés ni journalisés — tests flag/consentement — dépend de : P9b
- [ ] PW.17 — Appel vocal et vidéo à deux (WebRTC, build de développement, serveur TURN à fournir — HUMAN_TODO) — dépend de : P6.17
- [ ] PW.18 — Regarder ensemble : lecture synchronisée de liens YouTube (lecture/pause/position par WebSocket) + compte à rebours « lancez ensemble » pour les autres plateformes — tests de synchronisation — dépend de : P3.11

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
- [ ] P4.12 — App `games` : moteur des jeux de correspondance (paquets, cartes à 2–4 choix image ou texte, une réponse par personne, révélation quand les deux ont joué : accords puis différences, jamais de score) + API — tests : la réponse de l'autre reste invisible avant d'avoir joué, partenaire/étranger — dépend de : P1.6
- [ ] P4.13 — Commande `import_pixabay` (clé `PIXABAY_API_KEY`, requêtes choisies par carte, téléchargement vers le stockage S3, métadonnées source, auteur et licence) — tests avec API simulée ; clé à fournir (HUMAN_TODO) — dépend de : P4.12, P2.1
- [ ] P4.14 — Paquets « Notre futur » fr+en : logement, salon, chambre, cuisine, ville ou campagne, voyages, mariage, enfants (combien, quand), animaux — validation des fixtures par test — dépend de : P4.13
- [ ] P4.15 — Mobile : jeux de correspondance (choix en photos, attente douce de l'autre, révélation des accords puis des différences présentées comme sujets de conversation) — tests — dépend de : P4.14, P1.16
- [ ] P4.16 — Envies communes : même moteur en mode « seulement les points communs » ; paquet intimité séparé, activé par un réglage explicite (classement 17+ dans STORE_RELEASE) — tests : une envie non partagée n'est jamais révélée — dépend de : P4.12
- [ ] P4.17 — Quiz « Tu me connais ? » : chacun répond pour soi puis devine l'autre, révélation des écarts sans score — API + mobile + tests — dépend de : P4.12, P1.16
- [ ] P4.18 — Langages de l'amour : test fr+en, résultat privé que l'on choisit de partager, idées d'attentions adaptées à l'autre — API + mobile + tests de confidentialité — dépend de : P4.12, P1.16
- [ ] P4.19 — Cartes de conversation : paquets fr+en (« Tu préfères… », enfance, projets fous…) et mode soirée hors écran (une carte, on pose le téléphone) — catalogue validé par test + mobile — dépend de : P4.1, P1.16

## P5 — Notifications (F9)
- [x] P5.1 — App `notifications` : PushDevice, NotificationPreference (par type) + API — tests partenaire/étranger — dépend de : P1.4
- [x] P5.2 — Service d'envoi Expo Push (heures calmes dans le fuseau de chacun, préférences, aucun contenu privé, gestion des tokens invalides) — tests HTTP mockés — dépend de : P5.1
- [ ] P5.3 — Celery Beat : souvenir du jour quotidien à heure locale — tests eager avec horloge figée — dépend de : P5.2, P2.6
- [ ] P5.4 — Rappels : événements, notes « À retenir », tâches — tests — dépend de : P5.2, P3.1, P3.3, P4.8
- [x] P5.5 — Mobile : enregistrement expo-notifications, canal Android, permission refusée sans crash, écran préférences + heures calmes — tests — dépend de : P5.1, P1.18
- [x] P5.6 — Mobile : ouverture d'une notification → bon écran — tests du routeur de notifications — dépend de : P5.5

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
- [ ] P6.14 — « Ensemble depuis » : jours ensemble, prochains anniversaires et jalons (100, 1 000 jours…) dans le fuseau de chacun, affichés sur Aujourd'hui — tests aux frontières (29 février, changement de fuseau) — dépend de : P1.7, P6.9
- [x] P6.15 — Météo du matin (API) : `MorningMood` (personne, jour local, humeur `joyful|happy|upset|angry`, besoin facultatif `space|hug|help|listen|nothing`), un par jour, effacée le lendemain ; endpoint « aujourd'hui » (la mienne + celle de l'autre), réponses courtes prédéfinies (`here|courage|tonight|thinking`) limitées, aucun historique ni statistique, rien n'indique qu'on n'a pas répondu — tests partenaire/étranger — dépend de : P1.6
- [x] P6.15b — Météo du matin (notifications) : invitation chaque matin à l'heure choisie (8 h par défaut, fuseau de chacun, heures calmes, préférence désactivable), notification immédiate au partenaire quand on remplit (texte complet ou discret selon son réglage) et pour les réponses courtes ; aucun rappel si on ne répond pas — tests eager avec horloge figée — dépend de : P6.15, P5.2
- [x] P6.15c — Météo du matin (mobile) : carte sur Aujourd'hui (« Bonjour Antoine, comment tu te sens ce matin ? »), conseil « comment lui parler » selon l'humeur et le besoin de l'autre, réponses en un geste, réponse directe depuis la notification (boutons d'action), réglages heure / discrétion / désactivation — tests — dépend de : P6.15b, P5.5
- [ ] P6.16 — Lettres à ouvrir plus tard : lettre chiffrée au repos, date d'ouverture, contenu refusé par l'API avant la date (même au destinataire), notification à l'ouverture — tests — dépend de : P8.1, P5.2
- [ ] P6.17 — Widget écran d'accueil iOS + Android (config plugin, données partagées App Group / SharedPreferences : compteur, prochaines retrouvailles, photo du jour, « Je pense à toi ») — `expo prebuild` vérifié — dépend de : P6.14, P6.6

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
- [ ] P8.8 — « Ma température » (1 à 5, privée) : au-dessus de 3, conseil d'attendre ; minuteur de pause de 20 min minimum et respiration guidée — tests — dépend de : P8.4, P8.7
- [ ] P8.9 — Gestes de réparation : messages courts prédéfinis fr+en (« On peut recommencer ? »…) envoyés en un geste, sans accusé de lecture — API + mobile + tests partenaire/étranger — dépend de : P8.4
- [ ] P8.10 — « Nos règles pour se disputer » : écrites ensemble au calme, rappelées pendant une pause — API + mobile + tests — dépend de : P8.4
- [ ] P8.11 — Après la réconciliation : chacun écrit ce qu'il a compris du besoin de l'autre (partagé seulement si l'auteur le choisit), jamais « qui avait raison » — tests de confidentialité — dépend de : P8.2

## P9 — Vie privée, export, séparation, suppression (F8)
- [ ] P9.1 — App `privacy` : DataExport + tâche Celery ZIP (JSON + photos) + lien temporaire + purge — tests (contenu du ZIP, aucun privé du partenaire) — dépend de : P2.4, P8.2
- [ ] P9.2 — Quitter le couple : passage en dissolution (30 jours), notification neutre, purge de l'espace partagé et des fichiers à l'échéance — tests — dépend de : P9.1, P5.2
- [ ] P9.3 — Suppression de compte (privé supprimé immédiatement, couple en dissolution) + API — tests — dépend de : P9.2
- [ ] P9.4 — App `legal` : pages web fr/en (confidentialité, conditions, support, suppression de compte avec formulaire) — tests HTTP 200 dans les deux langues, formulaire de suppression fonctionnel — dépend de : P9.3
- [ ] P9.5 — Mobile : écran « Tes données » + demande d'export — tests — dépend de : P9.1, P1.18
- [ ] P9.6 — Mobile : quitter le couple + supprimer le compte (confirmation calme) — tests — dépend de : P9.3, P1.18
- [ ] P9.7 — Maestro : suppression de compte — dépend de : P9.6

## P9b — Offre Premium (abonnement à petit prix, un achat pour le couple)
- [ ] P9b.1 — Backend : `Subscription` par couple (droit, expiration, store, produit) + webhook RevenueCat authentifié par secret + champ `premium` exposé dans le couple et un endpoint `features` — tests : webhook sans secret refusé, expiration, le partenaire bénéficie du même droit — dépend de : P1.7
- [ ] P9b.2 — Backend : helper unique `core.entitlements` (quotas et accès) : photos illimitées en Premium (gratuit : 300 par couple), lettres à ouvrir plus tard illimitées (gratuit : 3 en attente), paquets de jeux supplémentaires ; refus avec le code `premium_required` — tests de chaque limite — dépend de : P9b.1, P6.16, P4.14
- [ ] P9b.3 — Mobile : SDK RevenueCat (`react-native-purchases` + plugin), écran d'offre calme (prix clair, aucune urgence artificielle, rappel avant la fin d'un essai), restauration des achats, lien « gérer mon abonnement » — tests avec SDK simulé, refus/annulation sans crash — dépend de : P9b.1
- [ ] P9b.4 — Mobile : badges Premium discrets et proposition douce uniquement là où une limite est atteinte (jamais de pop-up interruptive) — tests — dépend de : P9b.2, P9b.3
- [ ] P9b.5 — Premium : « Livre de souvenirs » PDF mis en page (Celery, photos, citations, dates), prêt à imprimer — tests du contenu (aucune donnée privée) — dépend de : P9b.2, P2.4
- [ ] P9b.6 — Premium : thèmes de couleur et icônes d'app alternatives — tests des tokens (contraste AA de chaque thème) — dépend de : P9b.3
- [ ] P9b.7 — Docs : abonnements dans STORE_RELEASE (métadonnées, notes pour la revue Apple, conditions d'abonnement dans les pages légales) et HUMAN_TODO (compte RevenueCat, produits App Store Connect et Play Console) — dépend de : P9b.3

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
