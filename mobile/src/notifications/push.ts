/** Push registration: permission, Expo token, and telling the API about this phone. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api';

const TOKEN_KEY = 'nd.push-token';

export type PushStatus = 'granted' | 'denied' | 'undetermined';
export type EnableResult = 'enabled' | 'denied' | 'unavailable';

export async function pushStatus(): Promise<PushStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Asks permission (only when the person chose to), then registers this phone.
 * Never throws: a refusal or a missing setup simply means no push.
 */
export async function enablePush(): Promise<EnableResult> {
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.status === 'granted' ||
      (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return 'denied';
    const id = projectId();
    if (!Device.isDevice || !id) return 'unavailable'; // simulator, or EAS not set up yet
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.POST('/api/v1/notifications/devices/', {
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'enabled';
  } catch {
    return 'unavailable';
  }
}

/** Re-registers silently on launch when permission was already given. */
export async function refreshPushRegistration(): Promise<void> {
  if ((await pushStatus()) === 'granted') await enablePush();
}

/** On sign out: this phone stops receiving the couple's notifications. */
export async function forgetThisPhone(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api.POST('/api/v1/notifications/devices/forget/', {
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best effort: the server forgets tokens Expo reports as gone anyway.
  }
}
