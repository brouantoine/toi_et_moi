import type { ConfigContext, ExpoConfig } from 'expo/config';

import BRAND from './src/config/brand.json';

type PluginEntry = string | [string, Record<string, unknown>];

/**
 * Google Sign-In needs the reversed iOS client id as URL scheme. The plugin is only added
 * when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set (see docs/HUMAN_TODO.md).
 */
function googlePlugin(): PluginEntry[] {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return [];
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return [['@react-native-google-signin/google-signin', { iosUrlScheme }]];
}

/**
 * Invitation links (PV.5): `https://<host>/join/CODE` opens the app when installed
 * (universal link / verified app link), otherwise the backend's web page.
 * Only declared once the production domain is known (LINK_HOST, see HUMAN_TODO).
 */
const LINK_HOST = process.env.LINK_HOST;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: BRAND.name,
  slug: BRAND.slug,
  scheme: BRAND.scheme,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // White-dominant app: system dialogs, pickers and the keyboard stay light too.
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BRAND.bundleId,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    ...(LINK_HOST ? { associatedDomains: [`applinks:${LINK_HOST}`] } : {}),
  },
  android: {
    package: BRAND.bundleId,
    adaptiveIcon: {
      backgroundColor: '#1C1C1E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(LINK_HOST
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [{ scheme: 'https', host: LINK_HOST, pathPrefix: '/join/' }],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    ['expo-notifications', { color: '#B3132B', defaultChannel: 'default' }],
    [
      'expo-audio',
      {
        microphonePermission: `${BRAND.name} utilise le micro pour enregistrer tes notes vocales.`,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: `${BRAND.name} utilise ta position pour la distance et la carte que tu partages avec l'autre.`,
        // "Continuous sharing" is a separate opt-in inside the app (PW.5b).
        locationAlwaysAndWhenInUsePermission: `${BRAND.name} peut partager ta position avec l'autre même app fermée, si tu actives le partage en continu.`,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    // Android maps need a Google Maps key in production builds (HUMAN_TODO).
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' }],
    [
      'expo-image-picker',
      {
        // Library only: no camera permission. The microphone is declared by expo-audio
        // (voice notes); localized permission texts come with P11.1.
        photosPermission: `${BRAND.name} a besoin de tes photos pour les ajouter à vos souvenirs.`,
        cameraPermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        backgroundColor: '#1C1C1E',
      },
    ],
    ...googlePlugin(),
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Set by `eas init` (see docs/HUMAN_TODO.md); push registration is skipped without it.
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
  },
});
