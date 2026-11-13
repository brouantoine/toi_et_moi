# Bolingo : compiler et publier la version iOS

Ce document est pour toi qui publies Bolingo sur l'App Store avec ton compte Apple Developer. Tout est prêt dans cette branche (`ios-release`) : l'app est déjà branchée sur le serveur de production `https://api.bolingo.ci`.

## 0. Ce qu'il te faut

- Un Mac avec **Xcode à jour** (App Store), puis `xcode-select --install`.
- **Node.js 22** (`brew install node@22`) et **CocoaPods** (`brew install cocoapods`).
- Ton compte **Apple Developer** payant, avec l'accord **Applications payantes** signé (App Store Connect → Accords, taxes et banques). Sans lui, l'abonnement ne marche pas, même en test.

Tu compiles avec Xcode : pas besoin de compte Expo.

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

## 3. Les notifications push (une seule fois)

Les notifications sont envoyées par le service Expo d'Antoine, qui a besoin d'une clé push de ton compte Apple :

1. developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+**.
2. Nom « Bolingo Push », coche **Apple Push Notifications service (APNs)**, puis Continue → Register.
3. Télécharge le fichier `AuthKey_XXXXXXXXXX.p8`. Apple ne le donne qu'une fois : garde-le.
4. Envoie à Antoine, en privé (jamais sur un groupe ou un dépôt Git) : le fichier `.p8`, son **Key ID** (10 caractères) et ton **Team ID**.

L'identifiant du projet Expo est déjà dans `mobile/app.config.ts` : n'y touche pas.

## 4. L'abonnement Bolingo Plus

Les instructions détaillées sont dans `docs/APP_STORE.md`, section 2. En bref :

1. Dans App Store Connect, crée un groupe d'abonnements « Bolingo Plus » avec deux abonnements : `bolingo_plus_monthly` (1 mois) et `bolingo_plus_yearly` (1 an).
2. Dans RevenueCat, avec Antoine : ajoute l'app iOS, crée l'entitlement `plus` et l'offering par défaut.
3. Copie la clé publique iOS de RevenueCat (`appl_...`) dans `mobile/.env` :
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   ```

Sans cette clé, l'app fonctionne, mais l'écran Plus indique que l'achat est indisponible. Apple refusera la version tant que l'achat ne marche pas.

## 5. Compiler avec Xcode et envoyer à App Store Connect

Depuis `mobile/` :

```bash
npx expo prebuild --platform ios --clean
open ios/Bolingo.xcworkspace
```

`prebuild` génère le projet Xcode à partir de `app.config.ts` et installe les pods. Il lit aussi `mobile/.env` (adresse du serveur, clé RevenueCat).

Dans Xcode :

1. Cible **Bolingo** → onglet **Signing & Capabilities** : coche *Automatically manage signing* et choisis ton **Team**. Les capacités Push, Sign in with Apple et Associated Domains sont déjà déclarées.
2. Onglet **General** : version `1.0.0`. **Build** vaut 1 : augmente-le (2, 3...) à chaque nouvel envoi, car App Store Connect refuse deux fois le même numéro.
3. Facultatif, mais conseillé : branche un iPhone, choisis-le en haut, schéma **Release** (Product → Scheme → Edit Scheme → Run → Build Configuration), puis ▶. Vérifie la connexion, les messages et l'écran Plus.
4. En haut, choisis la destination **Any iOS Device (arm64)**, puis **Product → Archive**.
5. Dans la fenêtre Organizer : **Distribute App** → **App Store Connect** → **Upload**. La version apparaît dans TestFlight au bout de 10 à 30 minutes.

Ne commite jamais le dossier `ios/` : il est régénéré à chaque `prebuild`. Après un `git pull`, relance toujours `npx expo prebuild --platform ios --clean`, puis remets ton Team et un numéro de Build plus grand.

## 6. Avant d'envoyer en revue

Dans App Store Connect, remplis :

- **URL de confidentialité** : `https://bolingo.ci/legal/privacy/`
- **URL d'assistance** : `https://bolingo.ci/support/`
- **URL marketing** (facultatif) : `https://bolingo.ci`
- **Notes de revue** et **comptes de démonstration** : texte prêt dans `docs/APP_STORE.md`, section 6. Antoine crée les deux comptes sur le serveur et te donne le mot de passe.
- **Classification d'âge**, **étiquettes de confidentialité** et **captures** : voir `docs/APP_STORE.md`, section 5.

## 7. Les versions suivantes

- **Correction de code seulement** (écrans, textes, bugs) : Antoine la publie lui-même en mise à jour à distance (`npm run update:prod`). Tu n'as rien à faire.
- **Changement natif** (nouveau module, permission, icône, version d'Expo) : Antoine augmente `version` dans `mobile/app.config.ts` (par exemple `1.0.1`). Tu fais `git pull`, puis l'étape 5, et tu envoies la version en revue.

## 8. À renvoyer à Antoine

- Ton **Team ID** (developer.apple.com → Membership). Le serveur en a besoin pour que les liens d'invitation ouvrent l'app.
- L'**identifiant de bundle**, si tu l'as changé.
- L'**Apple ID numérique** de l'app (App Store Connect → Informations sur l'app).
