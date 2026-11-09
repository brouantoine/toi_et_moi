/**
 * Notification presentation: foreground behaviour, the Android channel, and the
 * action buttons ("categories") that let people answer straight from a notification.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

export const ANDROID_CHANNEL = 'default';
export const MOOD_CATEGORY = 'morning_mood';
export const PARTNER_MOOD_CATEGORY = 'partner_mood';
export const MOODS = ['joyful', 'happy', 'upset', 'angry'] as const;
export const QUICK_REPLIES = ['here', 'courage', 'thinking'] as const;

/** Action ids are prefixed so a tap can be routed without ambiguity. */
export const PROXIMITY_CHANNEL = 'proximity';
export const moodAction = (mood: string) => `mood:${mood}`;
export const replyAction = (reply: string) => `reply:${reply}`;

export async function configureNotifications(t: TFunction): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: t('notifications.channel'),
      importance: AndroidImportance.DEFAULT,
    });
    // "Your partner is near you" must be felt: its own channel, with vibration.
    await Notifications.setNotificationChannelAsync(PROXIMITY_CHANNEL, {
      name: t('notifications.proximityChannel'),
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 150, 400, 150, 200],
      enableVibrate: true,
    });
  }
  await Notifications.setNotificationCategoryAsync(
    MOOD_CATEGORY,
    MOODS.map((mood) => ({
      identifier: moodAction(mood),
      buttonTitle: t(`morning.moods.${mood}`),
      options: { opensAppToForeground: true },
    })),
  );
  await Notifications.setNotificationCategoryAsync(
    PARTNER_MOOD_CATEGORY,
    QUICK_REPLIES.map((reply) => ({
      identifier: replyAction(reply),
      buttonTitle: t(`morning.replies.${reply}`),
      options: { opensAppToForeground: true },
    })),
  );
}
