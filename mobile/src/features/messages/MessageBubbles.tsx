import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pause, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, MIN_TOUCH_TARGET, Text, useTheme } from '@/ui';

import type { Message } from './useMessages';

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function VoiceNote({ message, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const player = useAudioPlayer(message.media_url ? { uri: message.media_url } : null);
  const status = useAudioPlayerStatus(player);
  const duration = (message.duration_ms ?? 0) / 1000;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const fg = mine ? 'onPrimarySoft' : 'text';
  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || progress >= 1) void player.seekTo(0);
    player.play();
  };
  return (
    <View style={[styles.voice, { gap: spacing.smd }]}>
      <Pressable
        testID={`voice-toggle-${message.id}`}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing
            ? t('messages.pause')
            : t('messages.play', { duration: formatDuration(message.duration_ms ?? 0) })
        }
        onPress={toggle}
        style={[styles.play, { backgroundColor: mine ? colors.primary : colors.secondary }]}
      >
        <Icon
          icon={status.playing ? Pause : Play}
          size={18}
          color={mine ? 'onPrimary' : 'onSecondary'}
          filled
        />
      </Pressable>
      <View style={styles.flex}>
        <View style={[styles.track, { backgroundColor: mine ? colors.surface : colors.border }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${progress * 100}%`,
                backgroundColor: mine ? colors.primary : colors.secondary,
              },
            ]}
          />
        </View>
        <Text variant="caption" color={fg} style={{ marginTop: spacing.xs }}>
          {formatDuration(status.playing ? status.currentTime * 1000 : (message.duration_ms ?? 0))}
        </Text>
      </View>
    </View>
  );
}

/** One message: mine on the right in soft red, theirs on the left; time below. */
export function MessageBubble({
  message,
  onLongPress,
}: {
  message: Message;
  onLongPress?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const mine = message.author === 'me';
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(message.created_at));
  const pending = message.id < 0;
  const label =
    message.kind === 'voice'
      ? t('messages.voiceLabel', { duration: formatDuration(message.duration_ms ?? 0) })
      : message.kind === 'photo'
        ? t('messages.photoLabel')
        : message.text;

  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <Pressable
        testID={`message-${message.id}`}
        accessibilityLabel={`${mine ? t('messages.fromMe') : t('messages.fromPartner')} : ${label}, ${time}`}
        accessibilityHint={mine && onLongPress ? t('messages.deleteHint') : undefined}
        // Explicit: a long press on the partner's message never offers to delete it.
        onLongPress={() => {
          if (mine) onLongPress?.();
        }}
        delayLongPress={350}
        style={[
          styles.bubble,
          {
            backgroundColor: mine ? colors.primarySoft : colors.surfaceMuted,
            borderRadius: radii.lg,
            borderBottomRightRadius: mine ? 6 : radii.lg,
            borderBottomLeftRadius: mine ? radii.lg : 6,
            padding: message.kind === 'photo' ? 4 : spacing.smd,
            opacity: pending ? 0.7 : 1,
          },
        ]}
      >
        {message.kind === 'photo' && message.media_url ? (
          <Image
            source={{ uri: message.media_url }}
            style={[
              styles.photo,
              {
                borderRadius: radii.md,
                aspectRatio:
                  message.width && message.height ? message.width / message.height : 4 / 3,
              },
            ]}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : message.kind === 'voice' ? (
          <VoiceNote message={message} mine={mine} />
        ) : (
          <Text color={mine ? 'onPrimarySoft' : 'text'}>{message.text}</Text>
        )}
      </Pressable>
      <Text variant="caption" muted style={{ marginTop: 2, marginHorizontal: spacing.xs }}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '82%', marginVertical: 3 },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderCurve: 'continuous', overflow: 'hidden' },
  photo: { width: 220 },
  voice: { flexDirection: 'row', alignItems: 'center', minWidth: 200 },
  play: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
