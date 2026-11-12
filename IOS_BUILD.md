# Bolingo : compiler et publier la version iOS

Ce document est pour toi qui publies Bolingo sur l'App Store avec ton compte Apple Developer. Tout est prêt dans cette branche (`ios-release`) : l'app est déjà branchée sur le serveur de production `https://api.bolingo.ci`.

## 0. Ce qu'il te faut

- Un Mac avec **Xcode à jour** (App Store), puis `xcode-select --install`.
- **Node.js 22** (`brew install node@22`) et **CocoaPods** (`brew install cocoapods`), seulement pour la méthode B.
- Ton compte **Apple Developer** payant, avec l'accord **Applications payantes** signé (App Store Connect → Accords, taxes et banques). Sans lui, l'abonnement ne marche pas, même en test.
- Un compte **Expo** gratuit (https://expo.dev/signup) : il sert aux notifications push.

## 1. Récupérer le code

```bash
git clone -b ios-release https://github.com/brouantoine/toi_et_moi.git bolingo
cd bolingo/mobile
npm ci
```

L'app mobile est dans `mobile/`. Le dossier `backend/` est le serveur : tu n'y touches pas.

## 2. Une seule fois : l'identifiant de l'app

- Identifiant de bundle : **`com.bolingo.app`**, défini dans `mobile/src/config/brand.json`.
- S'il est déjà pris sur ton compte Apple, mets-en un autre dans `brand.json` (par exemple `com.tonnom.bolingo`). Préviens Antoine : le serveur doit connaître ce nom pour la connexion avec Apple.
- Dans **App Store Connect** → Apps → **+** → Nouvelle app : nom **Bolingo**, langue principale Français, l'identifiant de bundle ci-dessus.

## 3. Le projet Expo (notifications push)

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` affiche un identifiant de projet (une suite comme `1a2b3c4d-...`). Ajoute-le à la fin de `mobile/.env` :

```
EAS_PROJECT_ID=1a2b3c4d-...
```

## 4. L'abonnement Bolingo Plus

Les instructions détaillées sont dans `docs/APP_STORE.md`, section 2. En bref :

1. Dans App Store Connect, crée un groupe d'abonnements « Bolingo Plus » avec deux abonnements : `bolingo_plus_monthly` (1 mois) et `bolingo_plus_yearly` (1 an).
2. Dans RevenueCat, avec Antoine : ajoute l'app iOS, crée l'entitlement `plus` et l'offering par défaut.
3. Copie la clé publique iOS de RevenueCat (`appl_...`) dans `mobile/.env` :
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   ```

Sans cette clé, l'app fonctionne, mais l'écran Plus indique que l'achat est indisponible. Apple refusera la version tant que l'achat ne marche pas.

## 5A. Compiler et envoyer : méthode recommandée (EAS, dans le cloud)

Depuis `mobile/` :

```bash
export $(grep -v '^#' .env | xargs)
npx eas-cli@latest build --platform ios --profile production
```

- La commande demande ton identifiant Apple. Laisse-la **créer les certificats, le profil et la clé push** : réponds oui à chaque question.
- La compilation dure de 15 à 30 minutes dans le cloud d'Expo.

Pour l'envoyer à App Store Connect :

```bash
npx eas-cli@latest submit --platform ios --latest
```

Les numéros de build augmentent tout seuls.

## 5B. Compiler avec Xcode sur ton Mac (sans le cloud)

Depuis `mobile/` :

```bash
npx expo prebuild --platform ios --clean
open ios/Bolingo.xcworkspace
```

Dans Xcode :

1. Cible **Bolingo** → onglet **Signing & Capabilities** : coche *Automatically manage signing* et choisis ton **Team**. Les capacités Push, Sign in with Apple et Associated Domains sont déjà déclarées.
2. Onglet **General** : version `1.0.0`. Augmente **Build** (1, 2, 3...) à chaque nouvel envoi.
3. En haut, choisis la destination **Any iOS Device (arm64)**, puis **Product → Archive**.
4. Dans la fenêtre Organizer : **Distribute App** → **App Store Connect** → **Upload**.

Pour les notifications push avec cette méthode, il faut aussi lancer une fois `npx eas-cli@latest credentials -p ios` (Push Notifications → créer une clé), car c'est Expo qui les envoie.

Ne commite jamais le dossier `ios/` : il est régénéré à partir de `app.config.ts`.

## 6. Avant d'envoyer en revue

Dans App Store Connect, remplis :

- **URL de confidentialité** : `https://bolingo.ci/legal/privacy/`
- **URL d'assistance** : `https://bolingo.ci/support/`
- **URL marketing** (facultatif) : `https://bolingo.ci`
- **Notes de revue** et **comptes de démonstration** : texte prêt dans `docs/APP_STORE.md`, section 6. Antoine crée les deux comptes sur le serveur et te donne le mot de passe.
- **Classification d'âge**, **étiquettes de confidentialité** et **captures** : voir `docs/APP_STORE.md`, section 5.

## 7. À renvoyer à Antoine

- Ton **Team ID** (developer.apple.com → Membership). Le serveur en a besoin pour que les liens d'invitation ouvrent l'app.
- L'**identifiant de bundle**, si tu l'as changé.
- L'**Apple ID numérique** de l'app (App Store Connect → Informations sur l'app).
