import { useRouter } from 'expo-router';
import { Phone, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { IconButton, useTheme } from '@/ui';

import { useCallActions, useCurrentCallInfo, type CallKind } from './useCalls';

/** Call and video call, at the top of the conversation, like in every messenger. */
export function CallButtons() {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacing } = useTheme();
  const { start } = useCallActions();
  // Live voice/video need the installed app: hidden in store builds until it is ready,
  // so reviewers never meet a call button that cannot connect (App Store 2.1).
  const mediaReady = useCurrentCallInfo().data?.media_ready ?? false;
  if (!__DEV__ && !mediaReady) return null;

  const call = (kind: CallKind) =>
    start.mutate(kind, {
      onSuccess: () => router.push('/call'),
      onError: () => Alert.alert(t('calls.startErrorTitle'), t('calls.startError')),
    });

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <IconButton
        testID="call-audio"
        icon={Phone}
        label={t('calls.startAudio')}
        disabled={start.isPending}
        onPress={() => call('audio')}
      />
      <IconButton
        testID="call-video"
        icon={Video}
        label={t('calls.startVideo')}
        disabled={start.isPending}
        onPress={() => call('video')}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
