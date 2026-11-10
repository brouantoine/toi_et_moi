# Actions réservées aux humains

Liste tenue à jour par l'agent. Chaque point est préparé dans le code ; il ne reste que l'action humaine.

## Avant de lancer la boucle
- [ ] Ajouter `loop.sh` à la racine (il n'existait pas lors du bootstrap ; l'agent ne l'a pas créé).
- [ ] Optionnel : installer Docker Desktop pour `make up` (les tests n'en ont pas besoin).
- [ ] Optionnel sous Windows : installer GNU make (`winget install ezwinports.make`) ou utiliser les commandes PowerShell de `CLAUDE.md`.

## Identité
- [ ] Choisir le nom définitif : `mobile/src/config/brand.json` et `BRAND_NAME` (variable d'environnement backend).
- [ ] Choisir le bundle ID / package Android définitif (aujourd'hui `com.changeme.nousdeux` dans `mobile/src/config/brand.json`).
- [ ] Remplacer les icônes et le splash du template Expo (`mobile/assets/`) : des versions provisoires seront générées en P11.3, puis à refaire par un designer.
- [ ] Domaine, email de support, liens universels (Associated Domains / App Links).

## Comptes et clés (détaillés au fil des phases)
- [ ] Compte Apple Developer, compte Google Play Console, création des fiches apps.
- [ ] `npx eas-cli@latest login`, puis `npx eas-cli@latest init` dans `mobile/`.
- [ ] Credentials push : clé APNs (via EAS) et `google-services.json` Firebase.
- [ ] Clés Google OAuth (iOS, Android, web), Apple Sign In, S3, clé API Claude (optionnelle).
- [ ] Déploiement backend (voir `docs/DEPLOY.md`).
- [ ] Relecture juridique des pages légales (phase P9).
- [ ] Assets définitifs par un designer (phase P11).
- [ ] Captures d'écran stores, tests sur vrais appareils, test fermé Google Play si exigé.

## GitHub (push bloqué)
- [x] (Résolu le 2026-11-03 : les pushes passent.) Le push vers https://github.com/brouantoine/toi_et_moi est refusé : le jeton GitHub n'a pas le droit `workflow`, nécessaire pour `.github/workflows/ci.yml`. Lance dans un terminal, puis valide le code dans le navigateur :
  ```
  gh auth refresh -h github.com -s workflow
  gh auth setup-git
  cd C:\Users\DELL\nous-deux
  git push -u origin main
  ```

## Connexion Apple / Google
- [ ] Apple : activer la capacité « Sign in with Apple » sur l'identifiant d'app (EAS la configure à partir de `ios.usesAppleSignIn`). Mettre le bundle id définitif dans `APPLE_AUDIENCES` côté backend.
- [ ] Google : créer 3 clients OAuth (iOS, Android avec l'empreinte SHA-1 de signature EAS, Web) dans Google Cloud Console. Puis :
  - mobile (`eas.json` / variables EAS) : `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` ;
  - backend : `GOOGLE_CLIENT_IDS=<web>,<ios>,<android>`.

## Stockage S3
- [ ] Ajouter une règle de cycle de vie sur le bucket : supprimer les objets non référencés est géré par l'app, mais une règle « expirer les uploads multipart incomplets après 1 jour » est recommandée.

## Jeux de correspondance (P4.13)
- [ ] Créer un compte gratuit sur pixabay.com, récupérer la clé API (https://pixabay.com/api/docs/) et la fournir comme variable `PIXABAY_API_KEY` au backend. Licence Pixabay : usage commercial autorisé sans attribution ; l'app stocke ses propres copies (pas de lien direct vers Pixabay).

## Stores : classement d'âge
- [ ] Si le paquet « intimité » des envies communes (P4.16) est activé, déclarer un classement 17+ (App Store) / équivalent PEGI sur Google Play.

## Offre Premium (P9b)
- [ ] Créer un compte RevenueCat, y relier l'app iOS et Android, récupérer les clés publiques (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`) et le secret du webhook (`REVENUECAT_WEBHOOK_SECRET`, backend).
- [ ] Créer les produits d'abonnement dans App Store Connect et Google Play Console (mensuel 2,99 €, annuel 19,99 € ou prix choisis), un droit « premium » dans RevenueCat.
- [ ] Contrat « Apps payantes » signé dans App Store Connect et profil de paiement Google Play (comptes bancaires, fiscalité).

## Notifications push
- [ ] Après `npx eas-cli@latest init`, mettre l'identifiant du projet dans la variable `EAS_PROJECT_ID` (lue par `app.config.ts` → `extra.eas.projectId`) : sans lui, l'app n'enregistre pas le téléphone pour les notifications.
- [ ] Optionnel : activer la « sécurité renforcée des notifications » dans le tableau de bord Expo et fournir `EXPO_ACCESS_TOKEN` au backend.

## Liens d'invitation (PV.5)
- [ ] Choisir le domaine public (ex. `nousdeux.app`) : `PUBLIC_BASE_URL=https://nousdeux.app` (backend) et `LINK_HOST=nousdeux.app` (build mobile).
- [ ] iOS : `IOS_APP_IDS=TEAMID.<bundle id>` (Team ID du compte Apple Developer).
- [ ] Android : `ANDROID_PACKAGE=<bundle id>` et `ANDROID_CERT_FINGERPRINTS=<SHA-256 du certificat de signature>` (Play Console → Intégrité de l'app).
- [ ] Après publication : `IOS_STORE_URL` et `ANDROID_STORE_URL` pour afficher les boutons de téléchargement sur la page d'invitation.

## Carte de la distance (PW.5)
- [ ] Android en production : créer une clé Google Maps SDK for Android (Google Cloud), la restreindre au paquet de l'app, et la fournir dans `GOOGLE_MAPS_API_KEY` au moment du build. (Inutile dans Expo Go et sur iPhone, qui utilise Apple Plans.)

## Partage de position en continu (PW.5b)
- [ ] Faire un build de développement (`npx eas-cli build --profile development`) : l'arrière-plan ne marche pas dans Expo Go. À tester sur deux vrais téléphones (déplacement de plus de 200 m, passage sous 1 km).
- [ ] Stores : justifier la localisation en arrière-plan (Apple : texte de permission « Toujours » ; Google Play : formulaire « Accès à la position en arrière-plan » avec une courte vidéo de la fonction).

## Nom « Bolingo »
- [ ] Vérifier que « Bolingo » est libre sur l'App Store et Google Play, et qu'aucune marque déposée ne le bloque dans les pays visés.
- [ ] Confirmer l'identifiant `com.bolingo.app` (définitif dès le premier envoi sur les stores).

## Premium
- [ ] Confirmer les prix (proposés : 1,99 €/mois et 9,99 €/an pour deux) et créer les abonnements dans App Store Connect et Google Play.

## Coach IA
- [ ] Créer une clé API sur console.anthropic.com et la fournir au backend : `ANTHROPIC_API_KEY=...` (jamais dans le dépôt). En production, définir aussi `FIELD_ENCRYPTION_KEYS` (clé Fernet) pour chiffrer le fil.
