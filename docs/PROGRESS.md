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

## 2026-11-07 — P5.1 + P5.2 Notifications : appareils, préférences, envoi Expo
- Fichiers clés : `backend/notifications/{models,services,tasks,views,serializers,urls}.py`, `notifications/tests/test_notifications.py`.
- Endpoints : `POST/DELETE /api/v1/notifications/devices/` (`{token, platform}`), `GET/PATCH /api/v1/notifications/preferences/` (un interrupteur par type, `morning_time`, `discreet`).
- À savoir : `notifications.services.notify(user, kind, title, body, data, category)` est le seul point d'envoi : préférence du type, heures calmes dans le fuseau de la personne (y compris à cheval sur minuit), tous ses téléphones, tâche Celery `send_push` (API Expo via `urllib`, sans nouvelle dépendance), jetons `DeviceNotRegistered` oubliés. Un jeton appartient à la dernière personne qui l'enregistre. Variable optionnelle `EXPO_ACCESS_TOKEN`.

## 2026-11-07 — P6.15 + P6.15b Météo du matin (API et notifications)
- Fichiers clés : `backend/rituals/{models,services,messages,views,serializers,tasks,urls}.py`, `rituals/tests/test_morning.py`, `notifications/models.py` (`last_morning_invite`), `config/settings/base.py` (Celery Beat).
- Endpoints : `GET/PUT/DELETE /api/v1/morning/today/` (`{mood, need}` ; réponse `{date, mine, partner}`), `POST /api/v1/morning/reply/` (`{reply}`, 3 par jour, 404 s'il n'y a rien à quoi répondre).
- Humeurs : `joyful` Grande joie, `happy` Bonne humeur, `upset` Contrariété, `angry` Énervement ; besoins `space|hug|help|listen|nothing` ; réponses `here|courage|tonight|thinking`.
- Notifications (textes serveur fr/en dans `rituals/messages.py`) : invitation « Bonjour Antoine / Comment tu te sens ce matin ? » à l'heure locale choisie (fenêtre de 15 min, une fois par jour, pas si déjà rempli, catégorie `morning_mood` pour les boutons d'action) ; au partenaire, dès qu'on remplit ou change : « Énervement ce matin · besoin d'espace. Laisse un peu d'espace, un mot court suffit. », ou « Antoine a partagé sa météo du matin. » en mode discret ; réponses courtes notifiées pareil. Aucun rappel. Météos effacées après deux jours (avec leurs réponses).
- Bug évité grâce aux tests : l'invitation ne visait que les personnes ayant déjà ouvert leurs préférences ; elle parcourt maintenant toutes les personnes en couple actif.

## 2026-11-07 — P5.5 + P5.6 Mobile : notifications
- Fichiers clés : `mobile/src/notifications/{setup,push,responses}.ts`, `features/notifications/{NotificationSettingsScreen,usePreferences}.ts(x)`, route `src/app/settings/notifications.tsx` (lien depuis Moi), `jest.setup.ts` (mocks), tests `notifications/__tests__/notifications.test.tsx` ; backend `POST /api/v1/notifications/devices/forget/` et boutons de réponse sur la notification de météo du partenaire.
- Permission demandée seulement quand la personne le choisit (carte douce), refus et absence de projet EAS sans plantage (`enable/denied/unavailable`). Enregistrement silencieux au lancement si déjà autorisé, téléphone oublié à la déconnexion. Canal Android `default`, notifications affichées aussi app ouverte. Boutons d'action traduits : `morning_mood` (4 humeurs) et `partner_mood` (Je suis là / Courage / Je pense à toi), qui répondent puis ouvrent l'app sur le bon écran (routes connues uniquement).
- Réglages : un interrupteur par type, heure de l'invitation du matin, mode discret, heures calmes.

## 2026-11-07 — P6.15c Météo du matin (mobile)
- Fichiers clés : `mobile/src/features/today/{TodayScreen,MorningCards,useMorning,moods}.ts(x)`, route `src/app/(tabs)/today.tsx`, tests `today/__tests__/today.test.tsx` ; backend `rituals/signals.py` (temps réel `morning`).
- Onglet Aujourd'hui : date, proposition douce d'activer les notifications, « Bonjour Antoine / Comment tu te sens ce matin ? » avec 4 grandes tuiles d'humeur colorées (groupe radio accessible, haptique), puis besoin facultatif, réponses reçues (« Sam : Je suis là »), « Retirer ». Carte de l'autre : sa météo et son besoin, conseil « comment lui parler » (besoin sinon humeur), 4 réponses en un geste, limite expliquée ; si rien n'est partagé : « Sam n'a pas encore partagé sa météo. Aucune obligation. ». Mise à jour instantanée sur les deux téléphones.
- Réponse directe depuis la notification : faite en P5.5/P5.6 (boutons `morning_mood` et `partner_mood`).

## 2026-11-07 — Essai sur téléphone avec Expo Go
- Connexion Google chargée à la demande (`features/auth/social/providers.ts`) : le module natif est absent d'Expo Go, un import en tête de fichier faisait planter l'app au lancement ; sans module, le bouton Google est masqué.
- Mode serveur léger pour essayer sans Docker : `DJANGO_LOCAL_LITE=1` (`config/settings/dev.py`) → temps réel en mémoire, tâches Celery exécutées tout de suite.
- Lancer un essai : `cd backend && DJANGO_LOCAL_LITE=1 .venv/bin/python manage.py runserver 0.0.0.0:8010`, puis `cd mobile && EXPO_PUBLIC_API_URL=http://<IP du PC>:8010 npx expo start --lan --go` et scanner le QR avec Expo Go (même Wi-Fi). Limites : pas d'envoi de photos sans MinIO, pas de notifications push dans Expo Go (Android) ni sans projet EAS.

## 2026-11-08 — Correctif : connexion impossible sur téléphone
- Symptôme (essai sur iPhone avec Expo Go) : « Pas de connexion » après chaque connexion, alors que le serveur répondait 200. Cause trouvée grâce au détail d'erreur affiché en développement : `onResponse: must return new Response() when modifying the response`. Le middleware d'authentification renvoyait la réponse telle quelle ; `openapi-fetch` exige alors qu'elle soit `instanceof Response`, ce qui est vrai sous Jest mais faux sous React Native (autre classe de Response).
- Correctif (`mobile/src/api/authMiddleware.ts`) : ne rien renvoyer quand la réponse n'est pas modifiée ; la réponse rejouée après rafraîchissement du jeton est reconstruite en `Response` global (`asResponse`). Tests qui reproduisent une réponse « d'une autre classe ».
- Aussi : détail technique des erreurs visible en développement seulement (écran d'erreur, écran de connexion, terminal Expo).

## 2026-11-09 — PV.1 Accueil vivant
- Fichiers clés : `mobile/src/features/today/{TodayCards,milestones,useToday,TodayScreen}.ts(x)`, tests `today/__tests__/home.test.tsx`.
- Aujourd'hui s'ouvre sur le couple : photo du couple en grand (voile + texte) ou les deux avatars qui se chevauchent sur fond rouge doux, « Antoine & Sam », « Ensemble depuis N jours », pastille du prochain jalon (anniversaire ou 100/200/500/1000 jours puis tous les 500 ; « C'est aujourd'hui » en rouge plein). Sans date de début : invitation à la renseigner. Puis la météo du matin, « Prochain moment » (agenda, teinte du type) et « Il y a N ans aujourd'hui » (souvenir avec photo), chaque carte ouvrant la bonne section.
- À savoir : jalons calculés sur les jours civils locaux, 29 février fêté le 28.

## 2026-11-09 — PV.2 Animations et célébrations
- Fichiers clés : `mobile/src/ui/motion.tsx` (`FadeIn`, `usePop`, `Celebration`), tests `ui/__tests__/motion.test.tsx`.
- Aujourd'hui : cartes qui arrivent l'une après l'autre ; gerbe de confettis aux couleurs de l'app sur l'en-tête le jour d'un jalon ; la tuile d'humeur choisie rebondit ; une gerbe salue une réponse de l'autre arrivée pendant que l'écran est ouvert. Souvenir : le cœur rebondit quand on le donne.
- À savoir : API Animated de React Native (pilote natif), sans nouvelle dépendance ; tout est immobile si « réduire les animations » est activé ; les confettis sont masqués au lecteur d'écran et ne captent pas le toucher.

## 2026-11-09 — PV.3 Messages (API)
- Fichiers clés : `backend/messaging/{models,services,messages,serializers,views,urls,signals}.py`, `messaging/tests/test_messages.py`, `core/storage.py` (formats audio m4a/aac/mp3, 10 Mo, `presign_upload` générique), `notifications/models.py` (type `messages`).
- Endpoints : `GET/POST /api/v1/messages/` (curseur, plus récents d'abord, 40 par page ; envoi `{kind: text|photo|voice, text, media_key, duration_ms, width, height}`), `DELETE /api/v1/messages/<id>/` (auteur seulement, fichier réellement effacé), `POST /api/v1/messages/upload-url/` (`{content_type}` image ou audio).
- À savoir : aucun champ de lecture (ni lu, ni vu, ni remis), aucun « en train d'écrire », aucun statut en ligne. Fichier vérifié : dans l'espace du couple, bon type selon le message, réellement envoyé, jamais réutilisé. Notification au partenaire (aperçu du texte, ou « t'a envoyé une note vocale / une photo », ou « t'a écrit » en mode discret), préférence `messages`, heures calmes. Limite d'envoi 60/min. Temps réel : ressource `messages`.

## 2026-11-09 — PV.4 Messages (mobile) avec notes vocales
- Fichiers clés : `mobile/src/features/messages/{MessagesScreen,MessageBubbles,useMessages,useVoiceRecorder}.ts(x)`, onglet `src/app/(tabs)/us.tsx` (Nous = le fil, en attendant check-in et idées), `media/images.ts` (`uploadFile` générique), `jest.setup.ts` (mock expo-audio), tests `messages/__tests__/messages.test.tsx` ; dépendances `expo-audio` (+ `expo-asset`, requis par expo-audio), plugin micro dans `app.config.ts` (et l'option micro désactivée du sélecteur de photos retirée : elle aurait effacé l'autorisation).
- Fil inversé, plus récents en bas, pagination vers le passé ; bulles (moi à droite en rouge doux, l'autre à gauche), heure ; texte envoyé instantanément (file hors ligne), photo (compressée, upload direct), note vocale : toucher pour enregistrer (chronomètre, annuler), toucher pour envoyer ; lecture avec pause et barre de progression ; appui long sur ses propres messages pour supprimer (jamais ceux de l'autre). Micro refusé expliqué avec lien vers les réglages. Temps réel (`messages`), notification → onglet Nous. Aucun « vu », « en train d'écrire » ni « en ligne ».

### PV.5 — Invitation facile (2026-11-09)
- Un seul bouton « Inviter ta moitié » : crée l'espace et ouvre aussitôt le partage (WhatsApp, SMS…). Le message contient un lien web `PUBLIC_BASE_URL/join/CODE/` qui marche même si l'autre n'a pas l'app : page aux couleurs de l'app (code en grand, « Ouvrir l'app », liens stores s'ils sont configurés, marche à suivre). La page ne consulte pas la base : elle ne révèle ni l'existence d'un code ni qui invite.
- Écran d'invitation : code, « Copier le code », QR code à scanner (lien web, encre sombre sur blanc quel que soit le thème), nouveau code, annulation.
- Côté invité : « Coller le code » accepte le code seul, le lien ou le message entier.
- Liens universels / app links : `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json` servis par le backend dès que les identifiants sont fournis ; `app.config.ts` les déclare si `LINK_HOST` est défini. `scripts/dev-phone.sh` règle `PUBLIC_BASE_URL` sur ce PC.
- Tests : page web (sans requête SQL, codes mal formés, langue, stores), fichiers d'association, `share_url` ; mobile : partage immédiat, copie, QR, extraction du code, collage.

## 2026-11-09 — PW.5 (API), PX.1 thème blanc, PX.2 couleur du couple
- Distance (API) : app `places`, index GeoNames hors ligne (34 208 villes, noms traduits : « Londres », « Bruxelles »), recherche `places/search/`, `couple/distance/` (ville et distance arrondie visibles seulement si les deux partagent, jamais de coordonnées).
- Thème : fond blanc pur, gris de remplissage, titres en police système grasse (façon Apple Music), ombres neutres ; sombre en noir pur. Sérif conservé pour les citations.
- Couleur du couple : 7 accents (rouge, ambre, sauge, lagon, bleu, violet, encre ; pas de rose), contrastes AA testés en clair et sombre, choisis dans Réglages > Notre couple, appliqués aussitôt (optimiste) et chez l'autre en temps réel (ressource `couple`).

## 2026-11-09 — Onglets façon capture, distance et carte par géolocalisation
- Barre d'onglets flottante (pilule blanche, ombre douce) avec les icônes de la capture : maison, cartes empilées, cœur, cloche, profil ; onglet actif sur fond gris, noms annoncés aux lecteurs d'écran.
- Distance (PW.5) : conditions versionnées (v2) acceptées par chacun, position lue avec expo-location quand l'app est ouverte (rafraîchie si elle date de plus de 15 min, jamais en arrière-plan), distance calculée côté serveur.
- Sous le nombre de jours : pastille « 45 km » qui ouvre l'écran « Où vous êtes » : carte (Apple Plans / Google Maps) avec vos deux positions reliées en pointillés, « 4 870 km vous séparent », ville de l'autre et heure de mise à jour, mise à jour, arrêt avec effacement immédiat. Rien n'est visible tant que les deux n'ont pas partagé.

## 2026-11-09 — PX.6a Accusés de lecture et « en train d'écrire »
- `Message.read_at`, `POST messages/read/` (marque les messages de l'autre comme lus quand la conversation est à l'écran), événement temps réel `messages`/`read`.
- Mobile : horloge (envoi), une coche (envoyé), deux coches à la couleur du couple (lu), annoncées aux lecteurs d'écran.
- « En train d'écrire » : signal WebSocket éphémère relayé au seul partenaire (jamais stocké, limité à 1/s côté serveur, renvoyé toutes les 3 s côté app, expire seul après 6 s) ; bulle à trois points animés (fixes si animations réduites).

## 2026-11-09 — PW.5b Partage en continu et proximité
- Conditions v3 (5 points, dont la vibration de proximité). « Partage en continu » : option séparée dans « Où vous êtes », permission « Toujours », tâche d'arrière-plan (expo-task-manager, tous les 200 m, indicateur système visible), reprise après redémarrage, arrêt à la déconnexion ou au retrait du consentement, rappel tous les 30 jours (tâche Celery quotidienne). L'autre voit que tu partages en continu.
- Proximité : sous 1 km (positions de moins de 24 h), notification qui vibre chez les deux (canal Android dédié) + vibration dans l'app ouverte (événement temps réel `distance`/`near`) ; réarmée au-delà de 2 km, au plus toutes les 3 h ; désactivable dans les notifications (« Proximité et partage de position »).
- Non vérifié sur appareil : l'arrière-plan ne fonctionne pas dans Expo Go (build de développement requis).

## 2026-11-10 — Jeux, accueil dense, premium, marque
- Backend `games` : accueil des jeux (paire du jour commune, « à ton tour », progression par sujet, types), réponses, réglage adulte, notes partagées, chiffres du couple. Illustrations Fluent Emoji 3D.
- Mobile : onglet Jeux (catégories, activités du jour, sujets), listes, écran de question (choix ou texte, attente, révélation des deux réponses), accueil (vos deux avatars reliés par la distance, accès rapide, activités du jour, premium, notes, à ton tour, compteur en direct, chiffres), écran Premium, icône et écran d'ouverture avec le logo et la caricature fournis.
- Pas encore faits : coach IA partagé, appels, widget, galerie par mois, « répondre avec une photo », « dessiner ».

## 2026-11-10 — Coach IA partagé et série de jours (mobile)
- Écran « Coach » (accueil › Accès rapide) : présentation et activation par chacun, fil commun (Toi / prénom de l'autre / Coach), bulle « le coach écrit », message calme en cas d'échec, effacement pour les deux, désactivation. Sans clé serveur : bandeau « pas encore activé » et saisie bloquée.
- Série de jours : badge (nombre + flamme) sur les activités du jour, à l'accueil et dans l'onglet Jeux.

## 2026-11-10 — En-tête du couple et photos de profil
- Une seule carte du couple en haut de l'accueil : vos deux avatars (anneau blanc, ombre douce) reliés par un pointillé, la distance au milieu dans une capsule blanche (ouvre la carte), puis vos prénoms, la bague et les jours, le prochain jalon. Le crayon sur mon avatar ouvre le choix de photo. Fini le doublon d'avatars et la bulle « Quoi de neuf ? ».
- Choix de la photo de profil (Moi › en-tête ou « Ta photo de profil ») : 24 personnages illustrés (6 personnages × 4 teintes de peau, Fluent Emoji 3D, MIT) choisis en un geste, ou une photo de la galerie. `User.avatar_preset` côté serveur, visible par l'autre.
- Initiales qui ne sont plus coupées ; tuiles « Bientôt » lisibles ; date du jour sous le titre au lieu d'un surtitre.

## 2026-11-10 — Jeux remplis, vocal maintenu, clavier collé
- Jeux : 298 questions fr/en (20 par sujet), 15 sujets dont « Avenir et engagement » (questions d'avant mariage : argent, enfants, foi, désaccords), « Notre histoire » et « Pour rire ». Inspirés des formats des apps de couple et des listes de questions pré-mariage, rédigés pour Bolingo.
- Notes vocales façon WhatsApp/Snapchat : maintenir le micro pour enregistrer, relâcher pour envoyer, glisser à gauche pour annuler (« Relâche pour annuler »), simple appui → explication. Niveau du micro mesuré pendant l'enregistrement, onde en bâtonnets en direct puis dans la bulle (remplissage pendant la lecture, toucher pour avancer). `Message.waveform` côté serveur (64 barres max, 0-100).
- Clavier : la zone de saisie se colle au clavier sur iPhone (marge calculée = hauteur du clavier moins la barre d'onglets, animée avec lui) ; sur Android la barre d'onglets se cache quand le clavier s'ouvre.


## 2026-11-11
- Jeux reconstruits en paquets : 146 paquets / 1 543 éléments, résultats avec jauge de similarité, dessin au doigt, réponse photo (stockage S3 requis), recherche et filtres, badges, accès 18+ à double accord. Tests backend et mobile verts.

## 2026-11-11 — Audit complet par 5 agents (supervisé)
- Accueil, onglets, couple, distance, connexion : retour et clavier des écrans de connexion, notes cliquables, confirmation avant d'annuler l'espace, code d'invitation expiré (backend + test), protections contre les anciens caches, carte qui suit le mode nuit.
- Jeux, coach, premium : encre visible la nuit, tracés fiables, écran de dessin qui défile, paquet verrouillé → Débloquer, message du coach conservé si l'envoi échoue, avatars qui se chevauchent.
- Messages, notifications : messages non envoyés gardés avec « Réessayer », vocaux qui ne s'interrompent plus, séparateurs de jour, photo plein écran, appui long copier/supprimer, clavier Android bord à bord, réglage « Messages et coach ».
- Souvenirs, organisation : bouton retour rond, croix sur les formulaires en erreur, clavier des feuilles iOS, part nulle d'une dépense, date des événements, actions sur éléments pas encore confirmés.
- Design system, profil : un seul rouge la nuit (#FF3B4E), tests de contraste sur `wash`/`brand`, feuille et interrupteur lisibles la nuit, curseur à la couleur du couple, `IconButton disabled`, bouton retour sans capsule iOS 26, pas de flash blanc la nuit.
- Vérifié : tsc, eslint, jest 695/695, backend ruff/mypy/pytest. Non vérifié sur un vrai téléphone.
