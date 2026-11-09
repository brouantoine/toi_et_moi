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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: BRAND.name,
  slug: BRAND.slug,
  scheme: BRAND.scheme,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BRAND.bundleId,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BRAND.bundleId,
    adaptiveIcon: {
      backgroundColor: '#FFF8F2',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
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
        backgroundColor: '#FFF8F2',
        dark: { backgroundColor: '#16120F' },
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
