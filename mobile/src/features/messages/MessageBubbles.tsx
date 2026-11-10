import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Check, CheckCheck, Clock, Pause, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Icon, MIN_TOUCH_TARGET, Text, useReducedMotion, useTheme } from '@/ui';

import type { Message } from './useMessages';
import { placeholderWaveform } from './waveform';
import { Waveform } from './Waveform';

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
  const bars = message.waveform?.length ? message.waveform : placeholderWaveform(message.id);
  const accent = mine ? colors.primary : colors.secondary;
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
        hitSlop={6}
        style={[styles.play, { backgroundColor: accent }]}
      >
        <Icon
          icon={status.playing ? Pause : Play}
          size={18}
          color={mine ? 'onPrimary' : 'onSecondary'}
          filled
        />
      </Pressable>
      <View style={{ gap: 2 }}>
        <Waveform
          testID={`voice-wave-${message.id}`}
          bars={bars}
          progress={progress}
          played={accent}
          idle={mine ? colors.surface : colors.border}
          onSeek={(fraction) => {
            if (duration > 0) void player.seekTo(fraction * duration);
          }}
        />
        <Text variant="caption" color={mine ? 'onPrimarySoft' : 'textMuted'} style={styles.tabular}>
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
      <View style={[styles.meta, { gap: spacing.xs, marginHorizontal: spacing.xs }]}>
        <Text variant="caption" muted>
          {time}
        </Text>
        {mine ? <Receipt message={message} /> : null}
      </View>
    </View>
  );
}

/** Sending (clock), sent (one tick), read by the other (two ticks, in the couple colour). */
function Receipt({ message }: { message: Message }) {
  const { t } = useTranslation();
  const status = message.id < 0 ? 'Sending' : message.read_at ? 'Read' : 'Sent';
  const icon = status === 'Sending' ? Clock : status === 'Read' ? CheckCheck : Check;
  return (
    <View
      testID={`receipt-${status.toLowerCase()}`}
      accessible
      accessibilityLabel={t(`messages.status${status}`)}
    >
      <Icon
        icon={icon}
        size={16}
        color={status === 'Read' ? 'primary' : 'textMuted'}
        strokeWidth={2.4}
      />
    </View>
  );
}

const DOTS = [0, 1, 2] as const;

/** "Sam is typing…": three dots breathing in a bubble on the other's side. */
export function TypingBubble({ name }: { name: string }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [phases] = useState(() => DOTS.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(
      Animated.stagger(
        160,
        phases.map((phase) =>
          Animated.sequence([
            Animated.timing(phase, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(phase, { toValue: 0, duration: 280, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, phases]);

  return (
    <View
      testID="typing-bubble"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('messages.typing', { name })}
      style={[
        styles.typing,
        {
          gap: spacing.xs,
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.lg,
          paddingHorizontal: spacing.md,
          marginVertical: spacing.xs,
        },
      ]}
    >
      {phases.map((phase, index) => (
        <Animated.View
          key={DOTS[index]}
          style={[
            styles.dot,
            {
              backgroundColor: colors.textMuted,
              opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '82%', marginVertical: 3 },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderCurve: 'continuous', overflow: 'hidden' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 40,
    borderBottomLeftRadius: 6,
    borderCurve: 'continuous',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  photo: { width: 220 },
  voice: { flexDirection: 'row', alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  play: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
