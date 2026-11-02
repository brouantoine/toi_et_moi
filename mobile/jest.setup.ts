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
  const { Pressable } = require('react-native');
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
    Redirect: () => null,
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
  };
});
