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
