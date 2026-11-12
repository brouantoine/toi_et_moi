# Publier Bolingo sur l'App Store (et Google Play)

Ce guide liste, dans l'ordre, ce qu'il faut faire pour que la première version passe la revue d'Apple. Ce qui est déjà fait dans le code est marqué « fait ».

## 1. Avant tout : le compte Apple Developer

1. Dans App Store Connect, va dans **Accords, taxes et banques** :
   - signe l'accord **Applications payantes** (« Paid Apps Agreement ») ;
   - renseigne ton **compte bancaire (RIB)** et les **formulaires fiscaux**.

   Sans ces deux étapes, les achats intégrés ne fonctionnent pas, même en test.
2. Crée l'application avec l'identifiant de bundle `com.bolingo.app` (voir `mobile/src/config/brand.json`). Si cet identifiant est déjà pris, choisis-en un autre et change-le dans `brand.json`.
3. Note l'identifiant numérique de l'app (Apple ID) : `eas submit` le demande ou le retrouve tout seul.

## 2. L'abonnement Bolingo Plus

### Dans App Store Connect

1. **Abonnements** → crée un **groupe d'abonnements** « Bolingo Plus ».
2. Dans ce groupe, crée deux abonnements à renouvellement automatique :
   - `bolingo_plus_monthly`, durée 1 mois ;
   - `bolingo_plus_yearly`, durée 1 an.
3. Pour chacun, renseigne :
   - le prix (proposé : 1,99 € par mois, 9,99 € par an ; c'est toi qui décides) ;
   - le nom affiché et la description, en français et en anglais ;
   - une capture d'écran de l'écran Plus, exigée pour la revue.
4. Facultatif : une **offre de lancement**, par exemple 7 jours gratuits. L'app l'affiche automatiquement.
5. **Notifications du serveur App Store** : colle l'adresse fournie par RevenueCat (étape suivante), en version 2.

### Dans RevenueCat (gratuit jusqu'à 2 500 $ de revenus mensuels)

RevenueCat valide les achats auprès d'Apple et de Google, puis prévient notre serveur. Le code est déjà prêt.

1. Crée un projet, puis ajoute l'app iOS, avec la clé « In-App Purchase » générée dans App Store Connect, et l'app Android plus tard.
2. Crée un **entitlement** appelé exactement `plus`, et rattache-lui les deux produits.
3. Crée une **offering** par défaut contenant deux packages : « Monthly » → `bolingo_plus_monthly` et « Annual » → `bolingo_plus_yearly`.
4. Dans **Integrations → Webhooks** :
   - URL : `https://api.bolingo.ci/api/v1/billing/revenuecat/` ;
   - Authorization header : une longue phrase secrète, par exemple `Bearer xxxxxxxx`.

   Recopie exactement la même valeur dans `REVENUECAT_WEBHOOK_AUTH` du `.env` du serveur.
5. Récupère les **clés publiques SDK**. Elles ne sont pas secrètes, ce sont des variables EAS :
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY` ;
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.

   Commande : `npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --environment production`.
6. Sur le serveur de production, garde `BILLING_ACCEPT_SANDBOX=true`. L'équipe de revue d'Apple achète en mode test (sandbox) sur le serveur de production : si ces achats sont ignorés, Plus ne se débloque pas pendant la revue, et c'est un refus (règle 2.1).

### Déjà fait dans le code

- L'écran Plus affiche les vrais prix du store, dans la devise de la personne, avec la période et l'essai éventuel.
- L'achat et la restauration sont en place.
- Un bouton « Gérer mon abonnement » est disponible.
- Le texte de renouvellement automatique est placé à côté du bouton d'achat (règle 3.1.2).
- Les liens Conditions d'utilisation, Confidentialité et EULA d'Apple sont affichés.
- Un seul achat couvre les deux partenaires : le webhook met à jour `plus_until` du couple.
- Le coach offre un mois gratuit, puis demande Plus.

## 3. Offrir Plus à qui tu veux (sans paiement)

Deux moyens, selon le besoin.

**a. Cadeau direct, illimité (déjà en place).** Pour un ami, un testeur, un partenaire ou un influenceur : il te suffit de son email.
- **Depuis l'administration** : `https://api.bolingo.ci/admin/` → Bolingo Plus → **Plus offerts** → Ajouter. Saisis l'email, le nombre de jours et une raison. Son couple a Plus immédiatement, pour les deux partenaires.
- **Depuis le terminal du serveur** : `python manage.py offrir_plus email@exemple.com 30 --raison "ami"`.
- **Pour plusieurs couples à la fois** : dans Admin → Couples, coche les couples puis choisis l'action « Offrir 30 jours de Plus ».
- Les cadeaux s'ajoutent les uns aux autres. Ils n'écourtent jamais un cadeau ou un abonnement en cours.

**b. Codes promotionnels publics (campagnes).** Pour distribuer des codes à grande échelle (réseaux sociaux, événement), utilise les **codes d'offre Apple** : App Store Connect → ton abonnement → Codes d'offre. Côté Android, ce sont les codes promo de Google Play. Ces codes s'utilisent dans l'App Store, et RevenueCat les reconnaît automatiquement.

> **Ne pas faire** : un champ « entre ton code » dans l'app qui débloquerait Plus. La règle 3.1.1 d'Apple interdit de débloquer du contenu numérique avec son propre système de codes. C'est un motif de refus classique.

## 4. Points de la revue déjà traités

- **5.1.1(v) Suppression de compte** : Moi → Supprimer mon compte, avec une confirmation tapée. Tout l'espace du couple est effacé, et le partenaire est prévenu.
- **5.1.1 Confidentialité** :
  - politique de confidentialité, conditions d'utilisation et page d'assistance sur `/legal/privacy/`, `/legal/terms/` et `/support/`, en français et en anglais ;
  - liens dans l'app (inscription, Moi, écran Plus).
- **Textes des permissions** : en anglais par défaut, en français via `mobile/locales`. Chaque texte explique l'usage réel :
  - la position n'est utilisée que si tu acceptes, et « toujours » seulement si tu actives le partage en continu ;
  - le micro sert aux notes vocales et aux appels ;
  - les photos ne servent que celles que tu choisis.
- **Manifeste de confidentialité** (`privacyManifests` dans `app.config.ts`) : aucun pistage.
- **Connexion avec Apple** : proposée, puisque Google l'est aussi (règle 4.8).
- **Âge** : confirmation « 18 ans ou plus » obligatoire à l'inscription, vérifiée aussi par le serveur. Le contenu 18+ des jeux ne s'ouvre que si les deux partenaires l'activent.
- **2.1 Fonctions incomplètes** : les appels voix et vidéo sont branchés (WebRTC, relais coturn sur le serveur, `CALLS_MEDIA_READY=true`). Limite connue : l'app doit être ouverte pour sonner, faute de CallKit pour l'instant.
- **Coach IA** : sa charte interdit le contenu dangereux et oriente vers les secours en cas de danger. Il ne parle jamais d'un autre couple.

## 5. Fiche App Store (métadonnées)

- **Classification d'âge** : réponds honnêtement au questionnaire. Les thèmes sexuels et suggestifs fréquents, à cause des paquets 18+, conduisent à la classification la plus élevée (18+).
- **Catégorie** : Style de vie. Catégorie secondaire : Réseaux sociaux.
- **URL de confidentialité** : `https://bolingo.ci/legal/privacy/`.
- **URL d'assistance** : `https://bolingo.ci/support/`.
- **Contrat de licence** : celui d'Apple, par défaut. Nos conditions y font référence.
- **Étiquettes de confidentialité (« App Privacy »)**, toutes liées à l'identité de la personne et sans pistage :
  - Coordonnées : email, nom.
  - Contenu utilisateur : messages, photos, audio, autre contenu.
  - Localisation : précise, seulement si elle est activée.
  - Identifiants : identifiant utilisateur.
  - Achats : historique.
  - Diagnostics : journaux d'erreurs.
- **Captures d'écran** : uniquement l'app Bolingo, sans mention d'autres applications ni d'Android.

## 6. Notes pour l'équipe de revue (à coller dans App Store Connect)

Sur le serveur de production, crée les comptes de démonstration :

```
python manage.py comptes_revue --mot-de-passe "UnMotDePasseLong-2026"
```

Puis colle ce texte dans « Notes de revue » :

```
Bolingo is a private space for two partners. Every feature needs a couple, so we created two linked demo accounts (already paired, with Bolingo Plus active):

  Account A: review.a@bolingo.ci
  Account B: review.b@bolingo.ci
  Password: <the password above>

Sign in with account A. You can use account B on a second device to see real-time features (messages, games, shared coach).

- Location: optional. Asked only when the user opens "Distance" and accepts; "Always" is asked only if they turn on continuous sharing, to be warned when the partner is close.
- AI coach: shared by both partners, free for one month, then part of Bolingo Plus. It refuses to discuss other users and points to emergency services when there is danger.
- 18+ question packs open only when both partners turn them on.
- Subscription: Bolingo Plus (monthly/yearly), one purchase for both partners, managed through StoreKit and RevenueCat.
- Account deletion: Me > Delete my account.
```

## 7. Compiler

1. Lance `npx eas-cli login`, puis `npx eas-cli init` depuis `mobile/`. Cette commande crée le projet EAS et l'identifiant `EAS_PROJECT_ID`.
2. **Version de développement installée** (pour tester les achats, les appels et les notifications) :
   ```
   npx eas-cli build --profile development --platform ios
   ```
3. **Version pour le store** :
   ```
   npx eas-cli build --profile production --platform ios
   npx eas-cli submit --profile production --platform ios
   ```
4. `EXPO_PUBLIC_API_URL` vaut `https://api.bolingo.ci` dans `eas.json` (domaine de production).

## 8. Ce qui reste à décider ou à fournir

- Domaine, serveur et stockage S3 : fait (bolingo.ci, OVH, Amazon S3).
- **Identité de l'éditeur** sur les pages légales : `LEGAL_ENTITY`, `LEGAL_ADDRESS` et `SUPPORT_EMAIL` dans le `.env` du serveur.
- **Relecture juridique** de la politique de confidentialité et des conditions d'utilisation.
- **Prix définitifs** de Plus.
- **Appels en direct** : il faut un module WebRTC, un serveur TURN, et CallKit pour faire sonner l'app fermée. Tant que ce n'est pas branché, les appels sont masqués dans la version publiée.
