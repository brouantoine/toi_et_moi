import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import { Image } from 'expo-image';
import { AlertCircle, Check, CheckCheck, Clock, Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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

/** Only one voice note plays at a time, like WhatsApp. */
let playing: AudioPlayer | null = null;
/** Signed media links expire (about an hour): an older one is renewed before playing. */
const SOURCE_TTL_MS = 30 * 60 * 1000;

function VoiceNote({ message, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  // The signed link changes on every refresh of the thread: keep the first one, or the
  // player would be rebuilt (and stop) each time a message arrives.
  const [source] = useState(() => (message.media_url ? { uri: message.media_url } : null));
  const [firstLoad] = useState(() => (source ? Date.now() : 0));
  const loadedAt = useRef(firstLoad);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const known = (message.duration_ms ?? 0) / 1000;
  const duration = known > 0 ? known : status.duration || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const bars = message.waveform?.length ? message.waveform : placeholderWaveform(message.id);
  const accent = mine ? colors.primary : colors.secondary;

  // Back to the start once heard, ready to be played again.
  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0).catch(() => {});
  }, [status.didJustFinish, player]);

  useEffect(
    () => () => {
      if (playing === player) playing = null;
    },
    [player],
  );

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (message.media_url && (!loadedAt.current || Date.now() - loadedAt.current > SOURCE_TTL_MS)) {
      player.replace({ uri: message.media_url });
      loadedAt.current = Date.now();
    }
    if (playing && playing !== player) {
      try {
        playing.pause();
      } catch {
        // Already released.
      }
    }
    playing = player;
    // A voice note is heard even with the phone on silent.
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    if (status.didJustFinish || progress >= 1) await player.seekTo(0).catch(() => {});
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
            : t('messages.play', { duration: formatDuration(duration * 1000) })
        }
        onPress={() => void toggle()}
        hitSlop={6}
        style={({ pressed }) => [
          styles.play,
          { backgroundColor: accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Icon
          icon={status.playing ? Pause : Play}
          size={18}
          color={mine ? 'onPrimary' : 'onSecondary'}
          filled
        />
      </Pressable>
      <View style={styles.voiceBody}>
        <Waveform
          testID={`voice-wave-${message.id}`}
          bars={bars}
          progress={progress}
          played={accent}
          idle={mine ? colors.onPrimarySoft : colors.textMuted}
          idleOpacity={0.35}
          onSeek={(fraction) => {
            if (duration > 0) void player.seekTo(fraction * duration).catch(() => {});
          }}
        />
        <Text variant="caption" color={mine ? 'onPrimarySoft' : 'textMuted'} style={styles.tabular}>
          {formatDuration(
            status.playing || status.currentTime > 0 ? status.currentTime * 1000 : duration * 1000,
          )}
        </Text>
      </View>
    </View>
  );
}

/** "14:05", or nothing when the date is unreadable (never a crash). */
function timeOf(iso: string | null | undefined, language: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Local calendar day of a message, to group the thread by day. */
export function dayKey(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Today", "Yesterday", "Monday 9 November" (with the year when it is not this one). */
export function DaySeparator({ iso }: { iso: string }) {
  const { i18n, t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const label =
    dayKey(iso) === dayKey(now.toISOString())
      ? t('messages.today')
      : dayKey(iso) === dayKey(yesterday.toISOString())
        ? t('messages.yesterday')
        : new Intl.DateTimeFormat(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
          }).format(date);
  return (
    <View
      testID={`day-${dayKey(iso)}`}
      accessibilityRole="header"
      style={[styles.day, { marginVertical: spacing.sm }]}
    >
      <Text
        variant="caption"
        muted
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.smd,
          paddingVertical: 2,
          overflow: 'hidden',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** One message: mine on the right in soft red, theirs on the left; time below. */
export function MessageBubble({
  message,
  failed = false,
  onPress,
  onLongPress,
}: {
  message: Message;
  /** It did not go: shown with a warning, a tap offers to resend it. */
  failed?: boolean;
  /** Tap on the bubble (a photo opens big, a failed message offers to resend). */
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const mine = message.author === 'me';
  const time = timeOf(message.created_at, i18n.language);
  const pending = message.id < 0 && !failed;
  const ratio = message.width && message.height ? message.width / message.height : 4 / 3;
  // A local file (just sent) keeps its own path; server links change, the photo does not.
  const photoSource =
    message.media_url && message.id > 0
      ? { uri: message.media_url, cacheKey: `message-photo-${message.id}` }
      : { uri: message.media_url ?? undefined };
  const label =
    message.kind === 'voice'
      ? t('messages.voiceLabel', { duration: formatDuration(message.duration_ms ?? 0) })
      : message.kind === 'photo'
        ? t('messages.photoLabel')
        : (message.text ?? '');

  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <Pressable
        testID={`message-${message.id}`}
        accessibilityLabel={`${mine ? t('messages.fromMe') : t('messages.fromPartner')} : ${label}, ${failed ? t('messages.statusFailed') : time}`}
        accessibilityHint={
          failed
            ? t('messages.retryHint')
            : onLongPress
              ? t(mine ? 'messages.optionsHint' : 'messages.copyHint')
              : undefined
        }
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.bubble,
          {
            backgroundColor: mine ? colors.primarySoft : colors.surfaceMuted,
            borderRadius: radii.lg,
            borderBottomRightRadius: mine ? 6 : radii.lg,
            borderBottomLeftRadius: mine ? radii.lg : 6,
            padding: message.kind === 'photo' ? 4 : spacing.smd,
            opacity: pending ? 0.7 : pressed && (onPress || onLongPress) ? 0.85 : 1,
            borderWidth: failed ? 1 : 0,
            borderColor: colors.danger,
          },
        ]}
      >
        {message.kind === 'photo' && message.media_url ? (
          <Image
            source={photoSource}
            style={[
              styles.photo,
              {
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                // Very tall or wide photos stay a reasonable bubble.
                aspectRatio: Number.isFinite(ratio) ? Math.min(2, Math.max(0.5, ratio)) : 4 / 3,
              },
            ]}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : message.kind === 'voice' ? (
          <VoiceNote message={message} mine={mine} />
        ) : (
          <Text color={mine ? 'onPrimarySoft' : 'text'}>{message.text ?? ''}</Text>
        )}
      </Pressable>
      <View style={[styles.meta, { gap: spacing.xs, marginHorizontal: spacing.xs }]}>
        {failed ? (
          <Text testID={`failed-${message.id}`} variant="caption" color="danger">
            {t('messages.notSent')}
          </Text>
        ) : (
          <Text variant="caption" muted>
            {time}
          </Text>
        )}
        {mine ? <Receipt message={message} failed={failed} /> : null}
      </View>
    </View>
  );
}

/** Sending (clock), sent (one tick), read by the other (two ticks, in the couple colour). */
function Receipt({ message, failed }: { message: Message; failed: boolean }) {
  const { t } = useTranslation();
  const status = failed ? 'Failed' : message.id < 0 ? 'Sending' : message.read_at ? 'Read' : 'Sent';
  const icon =
    status === 'Failed'
      ? AlertCircle
      : status === 'Sending'
        ? Clock
        : status === 'Read'
          ? CheckCheck
          : Check;
  return (
    <View
      testID={`receipt-${status.toLowerCase()}`}
      accessible
      accessibilityLabel={t(`messages.status${status}`)}
    >
      <Icon
        icon={icon}
        size={16}
        color={status === 'Read' ? 'primary' : status === 'Failed' ? 'danger' : 'textMuted'}
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
  voiceBody: { gap: 2 },
  day: { alignSelf: 'center' },
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
