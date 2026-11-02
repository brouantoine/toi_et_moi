/**
 * Native identity providers. Each returns the provider identity token (verified by
 * our backend), or null when the user cancelled. Nothing here is trusted client-side.
 */
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type SocialCredentials = { idToken: string; nonce?: string; firstName: string };

// Read at call time (EXPO_PUBLIC_* are inlined at build time by Expo).
const googleWebClientId = (): string => process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleIosClientId = (): string => process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export function isGoogleConfigured(): boolean {
  return googleWebClientId().length > 0;
}

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function isCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

export async function signInWithApple(): Promise<SocialCredentials | null> {
  // Apple embeds the value we pass as `nonce` in the token: we pass SHA-256(raw) and
  // send `raw` to the server, which hashes it and compares (replay protection).
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!credential.identityToken) return null;
    return {
      idToken: credential.identityToken,
      nonce: raw,
      firstName: credential.fullName?.givenName ?? '',
    };
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<SocialCredentials | null> {
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: googleWebClientId(),
      iosClientId: googleIosClientId() || undefined,
    });
    googleConfigured = true;
  }
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response) || !response.data.idToken) return null;
  return { idToken: response.data.idToken, firstName: response.data.user.givenName ?? '' };
}
