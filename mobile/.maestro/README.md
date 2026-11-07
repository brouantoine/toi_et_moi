# Parcours E2E Maestro

Prérequis : un simulateur iOS ou un émulateur Android avec un build de développement de l'app
(`npx eas-cli@latest build --profile development` ou `npx expo run:android`), et le backend
accessible à l'adresse `EXPO_PUBLIC_API_URL` utilisée pour ce build.

```sh
# installer Maestro : https://maestro.mobile.dev
maestro test mobile/.maestro/
```

Chaque parcours crée ses propres comptes (emails uniques horodatés). Les identifiants `id:`
correspondent aux `testID` du code ; un test Jest (`src/__tests__/maestro-ids.test.ts`) vérifie
qu'aucun parcours ne référence un `testID` inexistant.

## Parcours

| Fichier | Ce qu'il vérifie |
|---|---|
| `01_signup_couple_partner_joins.yaml` | Inscription, création du couple, le partenaire rejoint avec le code, 5 onglets. |
| `03_shared_grocery_list.yaml` | Repart du parcours 01, crée une liste de courses, ajoute deux articles, en coche un, retire les cochés. |
| `02_add_memory_with_photo.yaml` | Repart du parcours 01, dépose `assets/memory.jpg` dans la photothèque (`addMedia`), crée un souvenir avec cette photo, le retrouve dans la frise, ouvre le détail et met un cœur. |

Le sélecteur de photos est celui du système : son interface diffère entre iOS et Android et selon
la langue du simulateur. Le parcours 02 prévoit une branche par plateforme (libellés anglais et
français) ; si un système affiche d'autres libellés, ajuster uniquement ces deux blocs.
