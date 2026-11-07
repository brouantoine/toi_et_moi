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

## 2026-11-02 — P1.7 Endpoints couple
- Fichiers clés : `backend/couples/{serializers,views,urls}.py`, `couples/tests/test_api.py`.
- Endpoints : `GET/POST/PATCH/DELETE /api/v1/couple/` (couple courant de l'utilisateur ; DELETE = annuler un couple en attente), `POST couple/join/` (throttle `join` 10/min), `POST couple/invitation/` (nouveau code).
- Le partenaire voit : prénom, surnom, nom affiché, avatar, fuseau. Jamais l'email ni la date de naissance. Lien d'invitation `nousdeux://join/CODE` (`APP_SCHEME`).
- La validation backend vérifie aussi que le schéma OpenAPI se génère sans avertissement.

## 2026-11-02 — P1.8 + P1.9 Connexion Apple et Google (serveur)
- Fichiers clés : `backend/accounts/social.py` (vérification JWKS, iss, aud, exp, nonce Apple), `accounts/models.py` (`SocialAccount`), `accounts/services.py` (`sign_in_with_identity`), endpoint `POST /api/v1/auth/social/<apple|google>/`, `accounts/tests/test_social.py`.
- Variables : `APPLE_AUDIENCES` (bundle id, défaut `com.changeme.nousdeux`), `GOOGLE_CLIENT_IDS` (vide = Google désactivé, renvoie `provider_disabled`).
- Sécurité : un email non certifié par le fournisseur ne relie jamais un compte existant (`email_in_use`).

## 2026-11-02 — P1.10 Client API typé
- Fichiers clés : `scripts/api-types.sh` (schéma drf-spectacular → `mobile/src/api/schema.yaml` → `schema.d.ts`), `mobile/src/api/client.ts` (`openapi-fetch`), `mobile/src/config/env.ts`, `scripts/validate-mobile.sh`.
- À savoir : après tout changement d'API backend, lancer `sh scripts/api-types.sh` et commiter `mobile/src/api/`. La CI échoue si les types ne sont pas à jour.

## 2026-11-02 — P1.12a Icônes Lucide (demande utilisateur)
- Fichiers clés : `mobile/src/ui/Icon.tsx`, `mobile/src/ui/__tests__/Icon.test.tsx`, `mobile/src/__tests__/no-emoji.test.ts`.
- À savoir : `<Icon icon={Heart} />` est décoratif par défaut (masqué aux lecteurs d'écran) ; avec `accessibilityLabel`, il est annoncé. Couleur = clé de palette du thème.

## 2026-11-02 — P1.11 Socle données mobile
- Fichiers clés : `mobile/src/auth/{tokenStorage,authStore}.ts` (tokens dans expo-secure-store, état Zustand), `mobile/src/api/authMiddleware.ts` (Bearer + refresh unique partagé + rejeu, déconnexion si échec), `mobile/src/api/{errors,queryClient,QueryProvider,index}.ts`, `mobile/jest.setup.ts` (mocks secure-store et AsyncStorage).
- À savoir : utiliser `api` + `unwrap()` depuis `@/api` dans les hooks ; les erreurs sont des `ApiError` avec un `code` stable. Le cache TanStack Query est persisté 7 jours dans AsyncStorage (`CACHE_BUSTER` à incrémenter si la forme des données change). NetInfo est installé pour P3.6.

## 2026-11-02 — P1.12 Design system partie 2
- Fichiers clés : `mobile/src/ui/{Input,Avatar,EmptyState,ErrorState,LoadingState,Skeleton,Sheet}.tsx`, `mobile/src/test-utils.tsx` (`renderWithProviders`), `ui/__tests__/components.test.tsx`.
- À savoir : `ErrorState` prend un `code` (`ApiError.code`) et affiche un message calme traduit (`errors.*`). `Skeleton` respecte « réduire les animations ». `Sheet` repose sur le Modal natif. `Avatar` utilise expo-image avec cache disque. Avec React 19, `ref` est une simple prop (pas de `forwardRef`).

## 2026-11-03 — P1.13 Écrans d'authentification
- Fichiers clés : `mobile/src/features/auth/{LoginScreen,RegisterScreen,ForgotPasswordScreen,FormField,schemas,useAuthActions}.ts(x)`, routes `src/app/{login,register,forgot-password}.tsx`, `mobile/jest.setup.ts` (mock expo-router), `src/test-utils.tsx` (`renderWithProviders`, `mockFetch`, `routerMock`).
- À savoir : messages de validation zod = clés i18n. L'inscription envoie la langue de l'app et le fuseau de l'appareil. Le client API résout `fetch` à chaque appel (mockable en test). Mot de passe oublié : confirmation identique que le compte existe ou non.

## 2026-11-03 — P1.14 Boutons Apple et Google (mobile)
- Fichiers clés : `mobile/src/features/auth/social/{providers,useSocialLogin}.ts`, `SocialButtons.tsx`, `app.config.ts` (`usesAppleSignIn`, plugin `expo-apple-authentication`, plugin Google si `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`), mocks natifs globaux dans `jest.setup.ts`.
- À savoir : Apple uniquement sur iOS (bouton natif imposé par Apple), nonce SHA-256 envoyé à Apple et nonce brut au serveur. Google masqué tant que `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est vide. Une annulation par l'utilisateur ne produit ni appel API ni message.

## 2026-11-03 — P1.15 Formation du couple (mobile)
- Fichiers clés : `mobile/src/features/couple/{CoupleSetupScreen,JoinCoupleScreen,JoinLinkHandler}.tsx`, `useCouple.ts` (hooks + devise de l'appareil), `inviteLink.ts` (parseur `nousdeux://join/CODE`), `pendingInvite.ts`. Routes : `/couple`, `/couple/join`, `/join/[code]`.
- À savoir : pendant l'attente du partenaire, le couple est relu toutes les 10 s (le temps réel viendra en P3). Un code reçu par lien avant inscription est gardé dans `usePendingInvite` et pré-remplit l'écran de jonction.

## 2026-11-03 — P1.16 Navigation 5 onglets + garde
- Fichiers clés : `mobile/src/navigation/{gate,useGate}.ts` + `GateRedirect.tsx`, `src/app/_layout.tsx` (`Stack.Protected` par état), `src/app/(auth)/*`, `src/app/(tabs)/*` (Aujourd'hui, Souvenirs, Organisation, Nous, Moi), `src/features/shell/{tabs.ts,TabPlaceholder.tsx}`, `src/auth/useSignOut.ts`, `src/features/me/MeScreen.tsx`.
- À savoir : état `auth` → `/welcome`, `couple` → `/couple` (ou `/couple/join` si une invitation est en attente), `app` → `/today`. Les écrans d'onglets sont provisoires (état vide bienveillant). La déconnexion révoque le refresh token puis efface tokens et cache local, même hors ligne.

## 2026-11-03 — P1.17 Onboarding
- Fichiers clés : `mobile/src/features/onboarding/{OnboardingScreen.tsx,onboardingStore.ts}`, route `src/app/(auth)/onboarding.tsx`, `src/navigation/GateRedirect.tsx`.
- À savoir : 3 écrans (ensemble, douceur, ce que l'app ne fera jamais : pas de séries/score, pas de géolocalisation ni « vu à », pas de pub ni pistage, le privé reste privé). Drapeau `nd.onboarding.v1` dans AsyncStorage ; affiché seulement au premier lancement, avant l'écran d'accueil.

## 2026-11-03 — P1.18 Profil et infos du couple
- Fichiers clés : `mobile/src/features/me/{MeScreen,ProfileScreen,useProfile}.ts(x)`, `mobile/src/features/couple/CoupleInfoScreen.tsx` (+ `useUpdateCouple`), routes `src/app/settings/{profile,couple}.tsx` (protégées, en-tête avec retour), composants `ui/{DateField,Segmented,ListRow}.tsx`.
- À savoir : la langue du profil s'applique à la connexion (`useApplyProfileLanguage`) et dès l'enregistrement. Le fuseau peut être aligné sur celui du téléphone. Les dates passent par `DateField` (dialogue natif Android, feuille iOS) au format `AAAA-MM-JJ` local. La devise par défaut vient de la locale de l'appareil à la création du couple.

## 2026-11-03 — P1.19 Parcours Maestro inscription → couple → partenaire
- Fichiers clés : `mobile/.maestro/01_signup_couple_partner_joins.yaml`, `.maestro/subflows/register.yaml`, `.maestro/config.yaml`, `.maestro/README.md`, `mobile/src/__tests__/maestro-ids.test.ts` (chaque `id` des parcours doit exister comme `testID`).
- À savoir : le parcours joue les deux personnes sur le même appareil (déconnexion entre les deux). Ajout d'un bouton « Se déconnecter » sur l'écran du couple en attente (il manquait : une personne sans couple actif n'avait pas accès à l'onglet Moi). Maestro n'est pas exécuté ici (aucun simulateur sur cette machine Windows).
- **Phase P1 terminée.**

## 2026-11-03 — P2.1 Stockage : upload présigné et URL signées
- Fichiers clés : `backend/core/storage.py`, `core/tests/test_storage.py`.
- À savoir : upload direct par **POST présigné** (S3 impose type et taille max via la policy signée), clés `couples/<id>/<kind>/<uuid>.<ext>` ou `users/<id>/...`, `key_belongs_to()` empêche de confirmer une clé hors de son espace. Lecture via URL signées (15 min, `S3_URL_EXPIRE_SECONDS`). Nouvelle variable `S3_PUBLIC_ENDPOINT_URL` : adresse de MinIO joignable depuis le téléphone en dev.

## 2026-11-03 — P2.2 Modèles Souvenirs
- Fichiers clés : `backend/memories/{models,signals,admin}.py`, `memories/tests/{factories,test_models}.py`.
- À savoir : `Memory` (couple, auteur nullable, titre, texte, date, lieu libre, type, tags JSON), `MemoryPhoto` (clé S3 + miniature), `MemoryReaction` (un seul cœur par personne, aucun compteur), `MemoryComment`. La suppression d'une photo (ou d'un souvenir, en cascade) supprime réellement les fichiers après validation de la transaction. Si l'auteur supprime son compte, le souvenir reste au partenaire.

## 2026-11-03 — P2.3 API Souvenirs
- Fichiers clés : `backend/memories/{serializers,services,views,urls}.py`, `memories/tests/test_api.py`.
- Endpoints : `GET/POST /api/v1/memories/` (`?type=`, `?tag=`, `?q=` plein texte), `GET/PATCH/PUT/DELETE /api/v1/memories/<id>/`. Pagination curseur sur `-happened_on, -id`.
- À savoir : recherche plein texte Postgres (`SearchVector` config `simple`, requêtes « websearch ») et repli `icontains` sous SQLite. Cœurs exposés en booléens (`my_heart`, `partner_heart`), jamais de compteur. Liste sans N+1 (≤ 6 requêtes testé). Routers : `SimpleRouter` (pas de vue racine qui entrerait en conflit entre apps).

## 2026-11-03 — P2.4 API photos + miniatures
- Fichiers clés : `backend/memories/{photo_views,tasks}.py`, `memories/services.py` (`request_photo_upload`, `confirm_photo`), `core/serializers.py` (`ErrorCodeSerializer` partagé), `memories/tests/test_photos.py`.
- Endpoints : `POST /api/v1/memories/<id>/photos/upload-url/` (`{content_type}` → `{key, url, form_fields, max_bytes, expires_in}`), envoi du fichier en multipart vers `url` avec `form_fields`, puis `POST /api/v1/memories/<id>/photos/` (`{key, width?, height?}`), `DELETE .../photos/<photo_id>/`.
- À savoir : 10 photos max par souvenir (verrou sur la ligne du souvenir), la clé confirmée doit être dans l'espace du couple et réellement présente dans le stockage. Miniature JPEG 640 px (Pillow, `exif_transpose`) générée par Celery après commit ; une image illisible (ex. HEIC) garde l'original sans miniature. Pillow 13 ajouté.
- Reste à prévoir : les fichiers uploadés mais jamais confirmés (orphelins) seront purgés par la tâche de purge (P9) ou une règle de cycle de vie S3 (voir HUMAN_TODO).

## 2026-11-03 — P2.5 Cœur et commentaires
- Fichiers clés : `backend/memories/views.py` (action `heart`), `memories/comment_views.py`, `memories/tests/test_hearts_comments.py`, `core/auth.py` (`current_user`).
- Endpoints : `POST/DELETE /api/v1/memories/<id>/heart/` (idempotent, réponse `{my_heart}`), `GET/POST /api/v1/memories/<id>/comments/`, `DELETE .../comments/<cid>/` (auteur seulement, sinon 403 `not_author`). Commentaires ≤ 500 caractères.

## 2026-11-03 — P2.6 « Il y a N ans aujourd'hui »
- Fichiers clés : `backend/memories/services.py` (`local_today`, `on_this_day`), action `GET /api/v1/memories/on-this-day/` → `{date, items: [{years_ago, memory}]}`, `memories/tests/test_on_this_day.py`.
- À savoir : la date du jour est celle du fuseau de chaque personne (deux partenaires peuvent voir des jours différents). Le 28 février d'une année non bissextile inclut les souvenirs du 29 février.

## 2026-11-03 — P2.7 Photo de profil et photo de couple
- Fichiers clés : `backend/core/{uploads,upload_views}.py` (champ image unique générique), `accounts/avatar_views.py`, `couples/photo_views.py`, `core/tests/test_single_images.py`.
- Endpoints : `POST /api/v1/me/avatar/upload-url/`, `PUT/DELETE /api/v1/me/avatar/` ; `POST /api/v1/couple/photo/upload-url/`, `PUT/DELETE /api/v1/couple/photo/`. Même format de ticket que les photos de souvenirs (`form_fields`).
- À savoir : remplacer ou retirer une image supprime réellement l'ancien fichier (après commit). La clé doit appartenir à l'espace de l'utilisateur (avatar) ou du couple (photo).

## 2026-11-03 — P2.8 Frise des souvenirs (EN COURS, non cochée)
- Fichiers clés : `mobile/src/features/memories/{MemoriesScreen,MemoryCard,useMemories,memoryTypes}.ts(x)`, `mobile/src/api/pagination.ts`, route `src/app/(tabs)/memories.tsx`. Énumérations OpenAPI nommées (`MemoryTypeEnum`, `LanguageEnum`, `CoupleStatusEnum`).
- État : l'écran compile et passe le lint ; **les tests de la frise restent à écrire** avant de cocher P2.8.
- README rempli (avancement + prompt d'origine) à la demande de l'utilisateur.

## 2026-11-03 — P2.8 Frise des souvenirs (terminée) + montée en gamme du design system
- Fichiers clés : `mobile/src/ui/{tokens,theme,PressableScale,Chip,SearchField,IconButton,Medallion,Card,Button,Text,EmptyState,ErrorState,ListRow}.tsx`, `mobile/src/features/memories/{MemoriesScreen,MemoryCard,timeline}.ts(x)`, `features/memories/__tests__/memories.test.tsx`, `src/app/_layout.tsx` (chargement des polices).
- Design system : direction « carnet éditorial chaleureux ». Titres en serif **Fraunces** (`display`, `title`, `heading`, `quote` en italique), texte courant en police système (lisibilité, tailles dynamiques), nouvelle variante `overline`. Palette enrichie (`surfaceMuted`, `primarySoft`/`onPrimarySoft`, `secondarySoft`/`onSecondarySoft`, `scrim`/`onScrim`), toutes les paires vérifiées AA en clair et en sombre. Élévations en `boxShadow` chaudes et diffuses en clair, filet fin en sombre (`elevations`, `useSurfaceStyle`). Tokens `motion` + `useReducedMotion`.
- Nouvelles primitives : `PressableScale` (enfoncement doux, simple atténuation si « réduire les animations »), `Chip` (filtre, cible tactile 48 pt via hitSlop), `SearchField` (avec bouton effacer), `IconButton` (icône seule, label obligatoire), `Medallion` (icône dans un cercle teinté, états vides/erreur). `Button` gagne `soft`, `size="lg"`, `icon` et `style` (mise en page seulement).
- Frise : souvenirs groupés par mois (titres serif localisés), rail à gauche avec jour et jour de la semaine reliés par un fil, cartes éditoriales (couverture 4:3, pastille de type, titre serif, extrait, lieu, badge « +N photos »), citations en italique serif sans photo, pagination infinie avec indicateur, tirer pour rafraîchir. Squelette à la forme de la frise, état vide avec action, état « rien ne correspond », état d'erreur avec réessai.
- Vérification visuelle : export web de production + captures Chromium headless (clair, sombre, vide, chargement) via une route d'aperçu temporaire non commitée (voir DECISIONS).
- Dépendances : `@expo-google-fonts/fraunces`, `expo-font`, `expo-haptics` (pour « Je pense à toi », P6) ; correctifs Expo SDK 58 appliqués (`expo install --fix`), expo-doctor 20/20.
- Validation : 294 tests mobile verts, tsc, ESLint, expo-doctor.

## 2026-11-03 — P2.9 Création et édition d'un souvenir avec photos
- Fichiers clés : `mobile/src/media/images.ts` (pipeline image générique : choix, compression, upload présigné), `features/memories/{MemoryFormScreen,PhotoStrip,TagField,memoryForm,useSaveMemory}.ts(x)`, `useMemories.ts` (`useMemory`, `fetchMemory`), routes `src/app/memories/new.tsx` et `src/app/memories/[id]/edit.tsx` (modales), `ui/Notice.tsx`, tests `media/__tests__/images.test.ts` et `features/memories/__tests__/memoryForm.test.tsx`.
- Parcours : choix de 1 à 10 photos dans la photothèque (aucune permission demandée sur les systèmes récents ; un refus est expliqué avec un lien vers les réglages, jamais de plantage), compression côté client (côté le plus long ramené à 2048 px, JPEG 0,8, EXIF retiré), envoi séquentiel : ticket `upload-url` → POST multipart vers S3 → confirmation. Le bouton affiche « Envoi des photos, 2 sur 3 ».
- Échec partiel : le souvenir n'est jamais perdu. Si une photo échoue, l'écran reste ouvert, passe en mode édition (le nouvel essai fait un PATCH, pas de doublon) et ne renvoie que les photos en échec, marquées sur la bande.
- Design : page de carnet (titre serif sans bordure, filet, récit), détails en dessous (type en pastilles, date, lieu, mots-clés en pastilles sauge), bouton principal fixé en bas, haptique de succès, confirmation calme avant d'abandonner une saisie. `Input` et `DateField` passent au style teinté (bordure visible seulement au focus ou en erreur), ce qui harmonise aussi les écrans de connexion.
- Cache : après enregistrement, le détail est écrit directement dans le cache (pas de rechargement en double) et seules les listes sont invalidées.
- `app.config.ts` : plugin `expo-image-picker` (photothèque seulement, ni caméra ni micro). Textes de permission localisés prévus en P11.1.
- Validation : 329 tests mobile verts, tsc, ESLint, expo-doctor 20/20. Vérification visuelle (clair et sombre) par export web + captures.

## 2026-11-03 — P2.10 Détail d'un souvenir
- Fichiers clés : `features/memories/{MemoryDetailScreen,PhotoPager,MemoryComments,useMemoryDetail}.ts(x)`, `features/couple/usePartner.ts`, route `src/app/memories/[id]/index.tsx`, test `features/memories/__tests__/memoryDetail.test.tsx`.
- Écran : photos en pleine largeur (4:5) qu'on fait défiler, avec points de pagination ; retour et modifier en boutons ronds sur voile ; type, titre serif `display`, date complète, lieu, récit en variante `lead` (lecture longue) ou citation en italique serif avec filet terracotta, mots-clés. Sans photo : barre simple.
- Cœur : un seul, sans compteur (`switch` accessible), mise à jour optimiste avec retour en arrière si l'API refuse, haptique légère. « Sam y a mis un cœur » / « Vous y avez mis un cœur tous les deux » avec le prénom du partenaire (`usePartner`).
- Mots (commentaires) : bulles distinctes pour soi et pour l'autre, suppression de ses propres mots après confirmation, saisie avec bouton d'envoi, invitation douce quand il n'y en a pas, aucun accusé de lecture.
- Suppression du souvenir : bouton discret en bas de page (loin des actions courantes), confirmation calme qui rappelle que c'est pour vous deux et définitif.
- Design system : `Icon` gagne `filled`, `IconButton` la variante `overlay`, nouvelle variante typographique `lead`, `common.cancel`.
- Validation : 348 tests mobile verts, tsc, ESLint. Vérification visuelle clair et sombre par export web + captures.

## 2026-11-03 — P2.11 Parcours Maestro « ajouter un souvenir avec photo »
- Fichiers clés : `mobile/.maestro/02_add_memory_with_photo.yaml`, `.maestro/assets/memory.jpg` (photo de test générée), `.maestro/README.md` (tableau des parcours).
- Le parcours repart du 01 (couple actif), dépose la photo dans la photothèque (`addMedia`), passe par le sélecteur système (une branche iOS et une branche Android, libellés anglais et français), crée le souvenir, le retrouve dans la frise, ouvre le détail et met un cœur.
- Maestro n'est pas exécuté ici (aucun simulateur) ; le test Jest de cohérence des `testID` couvre le nouveau parcours.
- Tests du détail stabilisés (chargement et erreur séparés, cache « moi » et « couple » pré-rempli : plus d'avertissement `act`).
- **Phase P2 terminée.** 367 tests mobile verts, tsc, ESLint.

## 2026-11-03 — Finitions repérées sur les captures de l'app complète
- Captures de tous les écrans (32, clair et sombre) via l'export web, une API simulée et Playwright (outillage temporaire hors dépôt). Elles ont révélé et permis de corriger :
  - barre d'onglets : libellés rognés (« Aujourd'hui ») et tronqués (« Organisati… »). Hauteur explicite incluant la zone de sécurité, libellés 10 pt non compressibles (`src/app/(tabs)/_layout.tsx`) ;
  - typographie française : espaces insécables avant « : ; ! ? » et à l'intérieur des guillemets dans `fr.json` (plus de deux-points ni de guillemet seul en début de ligne) ;
  - écran de bienvenue refait (il datait de P0) : motif de deux disques qui se rejoignent, titre serif, « Commencer » et un accès direct « J'ai déjà un compte » ;
  - écrans Profil et Notre couple : titre en double retiré de la barre (le grand titre de page reste).
- Validation : 369 tests mobile verts, tsc, ESLint.

## 2026-11-03 — Palette rouge et sauge, teintes par type de souvenir, plan enrichi
- Fichiers clés : `mobile/src/ui/{tokens,theme,Icon,Chip}.ts(x)`, `features/memories/{memoryTypes,MemoryCard,MemoriesScreen,MemoryDetailScreen,MemoryFormScreen}.ts(x)`, `app.config.ts` (fond du splash), `ui/__tests__/tokens.test.ts`, `docs/PLAN.md`.
- Palette : rouge passion, sauge, crème chaude, encre ; mode sombre recomposé (pas inversé). Nouveaux tokens `hues` (5 teintes de catégorie) exposés par le thème ; `Icon` accepte `tint`, `Chip` colore son icône quand il n'est pas sélectionné.
- Souvenirs : une teinte par type (moment rouge, première fois ambre, lieu sauge, blague à nous lagon, citation violet) sur les pastilles, les filtres, un point sur le rail de la frise, l'en-tête du détail ; les citations deviennent des cartes teintées.
- Plan : 16 tâches ajoutées (P4.12–P4.19, P6.14–P6.17, P8.8–P8.11), total 129.
- Validation : tests de contraste AA étendus aux teintes (sur leur fond, sur le fond de l'app, texte et texte secondaire sur fond teinté).

## 2026-11-03 — P3.1 Agenda partagé (API)
- Fichiers clés : `backend/organization/{models,services,serializers,views,urls,admin}.py`, `organization/tests/test_events.py`.
- Endpoints : `GET/POST /api/v1/events/`, `GET/PATCH/PUT/DELETE /api/v1/events/<id>/`, `GET /api/v1/events/occurrences/?start=&end=` (400 jours max, récurrences annuelles déployées).
- À savoir : `kind` (event, birthday, reunion), `all_day` + `date`, ou `starts_at`/`ends_at` en UTC (le jour est alors celui du fuseau de l'auteur). `concerns` vaut `me`/`you`/`us` relativement à la personne qui lit ou écrit (stocké comme utilisateur, vide = nous). Anniversaire du 29 février fêté le 28 les années non bissextiles. `reminder_minutes` stocké (envoi en P5.4).

## 2026-11-03 — P3.2 Listes partagées (API)
- Fichiers clés : `backend/organization/{models,services,list_views,serializers}.py`, `organization/tests/test_lists.py`.
- Endpoints : `GET/POST /api/v1/lists/`, `/lists/<id>/`, `POST /lists/reorder/` (`{ids}`), `GET/POST /lists/<id>/items/`, `/lists/<id>/items/<item>/`, `POST /lists/<id>/items/reorder/`, `POST /lists/<id>/items/clear-done/`.
- À savoir : nouveaux éléments ajoutés en fin de liste ; `reorder` exige exactement les éléments de la liste (sinon 400) ; cocher enregistre `done_by` (`me`/`you` relatif au lecteur) et `done_at`, sans aucun décompte par personne ; `open_items` = éléments restants. Liste d'un autre couple : 404 partout, y compris sur ses éléments. Piège : `Meta.ordering` est ignoré par les requêtes agrégées, d'où l'`order_by` explicite. `services.reorder` / `next_position` réutilisables pour les tâches.

## 2026-11-03 — P3.3 Tâches de la maison (API)
- Fichiers clés : `backend/organization/{chore_views,services,serializers,models}.py`, `organization/tests/test_chores.py`.
- Endpoints : `GET/POST /api/v1/chores/` (`?done=true` pour les tâches ponctuelles terminées), `/chores/<id>/`, `POST /chores/<id>/complete/`, `POST /chores/<id>/reopen/`, `GET /chores/week/`.
- À savoir : `assignee` vaut `me`/`you`/`us` relatif au lecteur (énumération OpenAPI `RelativePersonEnum`, partagée avec `concerns` des événements). Terminer une tâche récurrente la reporte à la première échéance après aujourd'hui (pas de rattrapage culpabilisant) ; mensuelle : 31 janvier → 28 février. `week` = trois listes simples (moi, toi, nous) des tâches ouvertes de la semaine (lundi–dimanche, fuseau du lecteur) : aucun total, aucun score, aucun décompte de qui a fait quoi.

## 2026-11-03 — P3.4 Budget partagé (API)
- Fichiers clés : `backend/organization/{budget,expense_views,serializers,models}.py`, `organization/tests/test_budget.py`.
- Endpoints : `GET/POST /api/v1/expenses/` (curseur, plus récentes d'abord), `/expenses/<id>/`, `GET /expenses/balance/`, `POST /expenses/settle/` (`{currency}`).
- À savoir : montants entiers dans la plus petite unité de la devise ; devise par défaut celle du couple, date par défaut aujourd'hui (fuseau de la personne), payeur par défaut la personne. `paid_by` vaut `me`/`you`, `my_share`/`partner_share` sont relatifs au lecteur. 50/50 : l'unité impaire reste au payeur. Personnalisée : `my_share` obligatoire et ≤ montant ; changer le montant d'une dépense personnalisée exige la nouvelle part (jamais devinée). Solde par devise (`partner_owes_me` / `i_owe_partner` / `settled`), remboursement en un geste = un `Settlement` du montant exact. Aucune liaison bancaire.

## 2026-11-03 — P3.5 Temps réel (WebSocket)
- Fichiers clés : `backend/core/realtime.py` (consumer + `notify_changed`), `config/routing.py`, `organization/signals.py`, `core/tests/test_realtime.py`.
- Protocole (`/ws/v1/sync/`) : connexion, puis premier message `{"type":"auth","token":"<JWT d'accès>"}` dans les 10 s (jamais de jeton dans l'URL) ; réponse `{"type":"ready"}` ou fermeture 4401. Ensuite `{"type":"changed","resource":"events|lists|list_items|chores|expenses","id":…,"action":"upsert|delete|reorder"}` (+ `list_id` pour les éléments). `{"type":"ping"}` → `{"type":"pong"}`.
- À savoir : aucun contenu n'est poussé, seulement « telle ressource a changé » ; le téléphone recharge via l'API REST, seul point de contrôle d'accès. Diffusion après commit de la transaction, groupe par couple. Les réordonnancements (`bulk_update`, sans signal) notifient explicitement. Tests asynchrones écrits comme un scénario par test (une seule boucle d'événements), base transactionnelle.

## 2026-11-07 — P3.6 Mobile hors ligne
- Fichiers clés : `mobile/src/api/offline.ts`, `api/queryClient.ts`, `api/QueryProvider.tsx`, `api/__tests__/offline.test.ts`, `jest.setup.ts` (mock NetInfo officiel).
- À savoir : NetInfo pilote `onlineManager` ; hors ligne, les écritures se mettent en pause au lieu d'échouer. Pour qu'une écriture survive à un redémarrage, l'envoyer avec `mutationKey: OFFLINE_MUTATION_KEY` et une `QueuedRequest` sérialisable (`{method, path, pathParams, body}`) : elle est persistée avec le cache puis renvoyée après restauration (`resumeQueuedWrites`). `optimistic(client, key, update)` applique un changement au cache et renvoie son retour arrière. `useOnline()` pour l'interface. Piège des tests : un `QueryClient` doit être `mount()` pour reprendre ses écritures au retour du réseau (le provider le fait dans l'app).

## 2026-11-07 — P3.7 Mobile : synchronisation en temps réel
- Fichiers clés : `mobile/src/api/realtime.ts` (`SyncClient`, `invalidationKeysFor`, `syncUrl`), `api/useRealtimeSync.ts` (monté dans `(tabs)/_layout.tsx`), `api/__tests__/realtime.test.ts`.
- À savoir : authentification par premier message, ping toutes les 25 s, reconnexion 1 s → 2 s → 5 s → 10 s → 30 s ; refus 4401 → appel API (rafraîchit le jeton) puis nouvel essai. Coupé en arrière-plan (batterie), relancé au retour avec rattrapage (invalidation des données d'organisation). **Convention de clés de requête à respecter dans les écrans** : `['events', …]`, `['lists', …]` (les éléments d'une liste sous `['lists', id, 'items']`), `['chores', …]`, `['expenses', …]`.

## 2026-11-07 — P3.8 Mobile : agenda
- Fichiers clés : `mobile/src/features/organize/{OrganizeScreen,usePersonLabel}.ts(x)`, `organize/agenda/{AgendaView,EventFormScreen,eventForm,agendaDates,eventKinds,useAgenda}.ts(x)`, routes `src/app/organize/event/{new,[id]}.tsx` (modales), `ui/{TimeField,ToggleRow}.tsx`, tests `organize/__tests__/agenda.test.tsx`.
- Onglet Organisation : en-tête éditorial, pastilles Agenda / Listes / Tâches / Budget (les trois dernières « bientôt » jusqu'à P3.9–P3.11), bandeau hors ligne.
- Agenda : 90 prochains jours groupés par jour (« Aujourd'hui », « Demain », puis la date), une teinte par type (événement sauge, anniversaire ambre, retrouvailles rouge), heure ou « Journée », lieu, « Chaque année », pour qui (« Moi », prénom du partenaire, « Nous »). Formulaire : titre, type, date, journée entière ou heure, lieu, pour qui, chaque année, rappel ; modification et suppression avec confirmation.
- À savoir : `useQueuedWrite(invalidateKey)` envoie tout de suite en ligne (erreurs affichées) ou met en file hors ligne (part au retour du réseau, même après redémarrage). Les heures sont envoyées en instants UTC calculés depuis l'heure locale.

## 2026-11-07 — P3.9 Mobile : listes partagées
- Fichiers clés : `mobile/src/features/organize/lists/{ListsView,ListScreen,useLists}.ts(x)`, route `src/app/organize/list/[id].tsx`, tests `organize/__tests__/lists.test.tsx`.
- Section Listes : cartes (courses en ambre, libres en lagon) avec « N à faire » / « Tout est fait », création en ligne (titre + type). Écran d'une liste : ajout rapide qui garde le clavier, cases à cocher accessibles (`checkbox`), « Coché par Sam », retrait d'un élément, mode « Réordonner » avec boutons monter/descendre (accessible, sans glisser-déposer), « Retirer les éléments cochés », suppression de la liste avec confirmation.
- À savoir : toutes les actions sont optimistes (`optimistic`) et passent par `useQueuedWrite` (file hors ligne) ; retour arrière si le serveur refuse. Éléments ajoutés avec un id temporaire négatif, remplacé au rechargement.

## 2026-11-07 — P3.10 Mobile : tâches de la maison
- Fichiers clés : `mobile/src/features/organize/chores/{ChoresView,useChores}.ts(x)`, tests `organize/__tests__/chores.test.tsx`.
- Création en ligne (titre, qui s'en charge : Nous / Moi / prénom du partenaire, récurrence). « Qui porte quoi cette semaine » : trois groupes nommés, jamais de total ni de comparaison, une tâche en retard affiche simplement sa date (pas de rouge, pas de « en retard »). « Fait » et suppression instantanés (optimistes, file hors ligne).

## 2026-11-07 — P3.11 Mobile : budget, P3.12 Maestro liste de courses
- Fichiers clés : `mobile/src/features/organize/budget/{BudgetView,ExpenseFormScreen,expenseForm,money,categories,useBudget}.ts(x)`, routes `src/app/organize/expense/{new,[id]}.tsx`, tests `organize/__tests__/budget.test.tsx`, `.maestro/03_shared_grocery_list.yaml`.
- Budget : carte de solde en mots (« Tu dois 21,25 € à Sam », « Vous êtes à l'équilibre ») avec « Rembourser » après confirmation, dépenses paginées (catégorie colorée, montant, qui a payé, ta part). Formulaire : montant saisi à la française (« 12,50 »), devises sans centimes gérées (XOF), catégorie, qui a payé, 50/50 ou part personnalisée validée, date ; modification et suppression.
- Backend : `balance` et `settle` sans pagination (le schéma OpenAPI les décrivait à tort comme paginés).
- **Phase P3 terminée.**
