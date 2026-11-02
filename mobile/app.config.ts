import type { ConfigContext, ExpoConfig } from 'expo/config';

import BRAND from './src/config/brand.json';

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
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BRAND.bundleId,
    adaptiveIcon: {
      backgroundColor: '#FBF6EF',
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
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        backgroundColor: '#FBF6EF',
        dark: { backgroundColor: '#15171C' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
  },
});
