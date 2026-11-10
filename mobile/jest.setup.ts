/* Global Jest mocks for native modules and navigation. */
jest.mock('@react-native-async-storage/async-storage', () =>
  // jest.mock factories cannot use ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

/**
 * Lightweight expo-router mock: `Link` is a pressable link calling router.push(href).
 * Access the spies with `jest.requireMock('expo-router').__router`.
 */
jest.mock('expo-router', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  const Link = ({ href, children, testID }: { href: string; children: unknown; testID?: string }) =>
    React.createElement(
      Pressable,
      { testID, accessibilityRole: 'link', onPress: () => router.push(href) },
      children,
    );
  return {
    __router: router,
    router,
    useRouter: () => router,
    Link,
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, String(href)),
    Stack: Object.assign(() => null, { Screen: () => null, Protected: () => null }),
    SplashScreen: {
      preventAutoHideAsync: jest.fn(async () => true),
      hideAsync: jest.fn(async () => true),
    },
    // Screens are always focused in tests: the effect runs like a plain useEffect.
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
  };
});

/* Native sign-in modules (behaviour set per test through the jest.fn spies). */
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'raw-nonce',
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
}));

jest.mock('expo-apple-authentication', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { Pressable } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    isAvailableAsync: jest.fn(async () => true),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress, testID }: { onPress: () => void; testID: string }) =>
      React.createElement(Pressable, { onPress, testID, accessibilityRole: 'button' }),
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
  },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

/* Date picker: pressing it picks Feb 14 2020 (Android-like 'set' event). */
jest.mock('@react-native-community/datetimepicker', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { Pressable } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    __esModule: true,
    default: ({
      testID,
      onChange,
    }: {
      testID?: string;
      onChange: (e: unknown, d?: Date) => void;
    }) =>
      React.createElement(Pressable, {
        testID,
        onPress: () => onChange({ type: 'set' }, new Date(2020, 1, 14, 12)),
      }),
  };
});

/* Network state (NetInfo): official mock, online by default. */
jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

/* Notifications: permission undetermined by default; spies set per test. */
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  useLastNotificationResponse: jest.fn(() => null),
}));
jest.mock('expo-device', () => ({ isDevice: true }));

/* Audio (voice notes): recorder and player spies, configured per test. */
jest.mock('expo-audio', () => {
  const recorder = {
    uri: 'file:///note.m4a',
    prepareToRecordAsync: jest.fn(async () => {}),
    getStatus: jest.fn(() => ({ metering: -20 })),
    record: jest.fn(),
    stop: jest.fn(async () => {}),
  };
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => {}) };
  return {
    __recorder: recorder,
    __player: player,
    RecordingPresets: { HIGH_QUALITY: {} },
    useAudioRecorder: () => recorder,
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({
      playing: false,
      currentTime: 0,
      duration: 0,
      didJustFinish: false,
    }),
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => {}),
  };
});

/* Clipboard (invitation code) and QR code (svg) are replaced by light fakes. */
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));
jest.mock('react-native-qrcode-svg', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return function QRCode(props: { value: string }) {
    return createElement(View, { testID: 'qr-code', accessibilityValue: { text: props.value } });
  };
});

/* Location (distance) and maps: permission/position spies and plain views. */
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 48.8566, longitude: 2.3522 },
  })),
  ActivityType: { Other: 1 },
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => {}),
  stopLocationUpdatesAsync: jest.fn(async () => {}),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('react-native-maps', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const make =
    (name: string) =>
    ({ children, testID }: { children?: unknown; testID?: string }) =>
      createElement(View, { testID: testID ?? `map-${name}` }, children);
  return {
    __esModule: true,
    default: make('view'),
    Marker: make('marker'),
    Polyline: make('line'),
  };
});
