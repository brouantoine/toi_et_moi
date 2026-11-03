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
