/** JWT pair persisted in the device keychain/keystore (expo-secure-store), never AsyncStorage. */
import * as SecureStore from 'expo-secure-store';

const ACCESS = 'nd.access';
const REFRESH = 'nd.refresh';

export type Tokens = { access: string; refresh: string };

export async function readTokens(): Promise<Tokens | null> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(REFRESH),
  ]);
  return access && refresh ? { access, refresh } : null;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, tokens.access),
    SecureStore.setItemAsync(REFRESH, tokens.refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
}
