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
  // Store version; build numbers are incremented by EAS (eas.json, appVersionSource remote).
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Follows the phone: white and red by day, red on black at night (expo-system-ui applies
  // it on Android). System dialogs, pickers and the keyboard follow the same setting.
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BRAND.bundleId,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // Permission texts in English by default, French from locales/fr.json.
      CFBundleAllowMixedLocalizations: true,
      CFBundleDevelopmentRegion: 'en',
      // A call keeps its sound when the app goes to the background.
      UIBackgroundModes: ['audio'],
    },
    // Reasons for the "required reason" APIs used by React Native and Expo modules
    // (App Store privacy manifest, mandatory since May 2024).
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
      ],
    },
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
    predictiveBackGestureEnabled: true,
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
  locales: { en: './locales/en.json', fr: './locales/fr.json' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    // Android notification icon tint: the Bolingo red (tokens `brand`).
    ['expo-notifications', { color: '#D0112B', defaultChannel: 'default' }],
    [
      'expo-audio',
      {
        microphonePermission: `${BRAND.name} uses the microphone for the voice notes and calls you share with your partner.`,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: `${BRAND.name} uses your location to show the distance and the map you choose to share with your partner.`,
        // "Continuous sharing" is a separate opt-in inside the app (PW.5b).
        locationAlwaysAndWhenInUsePermission: `If you turn on continuous sharing, ${BRAND.name} shares your location with your partner even when the app is closed, to tell you both when you are close. You can stop at any time.`,
        locationAlwaysPermission: `If you turn on continuous sharing, ${BRAND.name} shares your location with your partner even when the app is closed, to tell you both when you are close. You can stop at any time.`,
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
        // The camera serves video calls only (WebRTC plugin below); French texts are in
        // locales/fr.json.
        photosPermission: `${BRAND.name} uses your photos only when you choose some to share with your partner (messages, memories, profile picture).`,
        cameraPermission: `${BRAND.name} uses the camera only during the video calls you make with your partner.`,
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
    // Live voice and video calls (installed app only; Expo Go has no native WebRTC).
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: `${BRAND.name} uses the camera only during the video calls you make with your partner.`,
        microphonePermission: `${BRAND.name} uses the microphone for your voice notes and calls with your partner.`,
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
