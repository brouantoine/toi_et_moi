import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mic, Phone, PhoneOff, Video, Volume2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePartner } from '@/features/couple/usePartner';
import {
  Avatar,
  Icon,
  PressableScale,
  Text,
  ThemeProvider,
  useReducedMotion,
  useTheme,
} from '@/ui';

import { RING_VIBRATION, SOUNDS } from './sounds';
import { isOver, useCallActions, useCurrentCall, type Call } from './useCalls';

const AVATAR = 132;

/** "02:15" since the call was picked up. */
export function callDuration(answeredAt: string | null | undefined, now: number): string {
  if (!answeredAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now - new Date(answeredAt).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Rings of light around the avatar while it rings. Still when motion is reduced. */
function Pulse({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [wave] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduced) return undefined;
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduced, wave]);
  if (!active) return null;
  return (
    <>
      {[0, 0.5].map((offset) => {
        const phase = Animated.modulo(Animated.add(wave, offset), 1);
        return (
          <Animated.View
            key={offset}
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: colors.brand,
                opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [
                  { scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
}

/** Big round call button with its label underneath. */
function RoundButton({
  testID,
  icon,
  label,
  tone,
  onPress,
  disabled = false,
}: {
  testID: string;
  icon: LucideIcon;
  label: string;
  tone: 'accept' | 'hangup' | 'neutral';
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const background =
    tone === 'accept' ? colors.secondary : tone === 'hangup' ? colors.brand : colors.surfaceMuted;
  const ink = tone === 'neutral' ? colors.text : colors.onScrim;
  return (
    <View style={[styles.action, { gap: spacing.sm, opacity: disabled ? 0.45 : 1 }]}>
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.9}
        style={[styles.round, { backgroundColor: background }]}
      >
        <Icon icon={icon} size={30} tint={ink} strokeWidth={2.2} />
      </PressableScale>
      <Text variant="caption" style={{ color: colors.onScrim }}>
        {label}
      </Text>
    </View>
  );
}

/** Plays a sound in a loop while `active`, from the start each time. */
function useLoop(player: AudioPlayer, active: boolean) {
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (!active) return undefined;
    void player.seekTo(0).catch(() => {});
    player.play();
    return () => player.pause();
  }, [active, player]);
  useEffect(() => {
    if (active && status.didJustFinish) {
      void player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => {});
    }
  }, [active, status.didJustFinish, player]);
}

/** Sounds and vibration for each moment of the call. */
function useCallSounds(call: Call | null, closing: string | null) {
  const ringtone = useAudioPlayer(SOUNDS.ringtone);
  const ringback = useAudioPlayer(SOUNDS.ringback);
  const hangup = useAudioPlayer(SOUNDS.hangup);
  const incoming = call?.state === 'ringing' && call.direction === 'incoming';
  const outgoing = call?.state === 'ringing' && call.direction === 'outgoing';

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useLoop(ringtone, incoming);
  useLoop(ringback, outgoing);

  useEffect(() => {
    if (!incoming) return undefined;
    Vibration.vibrate(RING_VIBRATION, true);
    return () => Vibration.cancel();
  }, [incoming]);

  useEffect(() => {
    if (!closing) return;
    void hangup.seekTo(0).catch(() => {});
    hangup.play();
  }, [closing, hangup]);
}

function CallContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const partner = usePartner();
  const current = useCurrentCall();
  const { accept, decline, end } = useCallActions();
  // The last call seen, kept to show how it ended once the server forgets it.
  const [last, setLast] = useState<Call | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const call = current.data ?? null;
  // Derived state, updated during render (React's documented pattern for "previous value").
  if (call && (call.id !== last?.id || call.state !== last.state)) setLast(call);
  const shown = call ?? last;
  // Once we saw a call, the end is either its final state or, if the server forgot it, "ended".
  let closing: string | null = null;
  if (last && (call === null || isOver(call))) {
    if (call && isOver(call)) closing = call.state;
    else closing = isOver(last) ? last.state : 'ended';
  }

  useCallSounds(call, closing);

  useEffect(() => {
    if (call?.state !== 'ongoing') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [call?.state]);

  // Over: say how it ended for a moment, then close.
  useEffect(() => {
    if (!closing && !(current.isSuccess && !call && !last)) return undefined;
    const timer = setTimeout(
      () => (router.canGoBack() ? router.back() : router.replace('/')),
      1400,
    );
    return () => clearTimeout(timer);
  }, [closing, current.isSuccess, call, last, router]);

  const name = partner?.display_name ?? '';
  const video = shown?.kind === 'video';
  let status: string;
  if (!shown) status = t('calls.status.connecting');
  else if (closing) status = t(`calls.status.${closing}`);
  else if (shown.state === 'ongoing') status = callDuration(shown.answered_at, now);
  else if (shown.direction === 'incoming')
    status = t(video ? 'calls.status.incomingVideo' : 'calls.status.incomingAudio');
  else status = t('calls.status.calling');

  const tap = (fn: () => void) => () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    fn();
  };
  const ringingIn = shown?.state === 'ringing' && shown.direction === 'incoming' && !closing;
  const live = shown && !closing && !isOver(shown);

  return (
    <SafeAreaView
      testID="call-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StatusBar style="light" />
      <View style={[styles.top, { gap: spacing.xs, paddingTop: spacing.xl }]}>
        <Text variant="overline" style={{ color: colors.textMuted }}>
          {t(video ? 'calls.video' : 'calls.audio')}
        </Text>
        <Text variant="title" style={styles.center} numberOfLines={1}>
          {name}
        </Text>
        <Text
          testID="call-status"
          style={[styles.status, { color: closing ? colors.textMuted : colors.text }]}
        >
          {status}
        </Text>
      </View>

      <View style={styles.middle}>
        <View style={styles.avatarWrap}>
          <Pulse active={shown?.state === 'ringing' && !closing} />
          <Avatar
            name={name || '?'}
            uri={partner?.avatar_url}
            preset={partner?.avatar_preset}
            size={AVATAR}
            ring
          />
        </View>
        {shown?.state === 'ongoing' && !shown.media_ready && !closing ? (
          <Text
            testID="call-media-note"
            variant="caption"
            style={[styles.note, { color: colors.textMuted, marginTop: spacing.xl }]}
          >
            {t('calls.mediaSoon')}
          </Text>
        ) : null}
      </View>

      <View style={[styles.bottom, { gap: spacing.xl, paddingBottom: spacing.xl }]}>
        {shown?.state === 'ongoing' && !closing ? (
          <View style={[styles.row, { gap: spacing.xl }]}>
            <RoundButton
              testID="call-mute"
              icon={Mic}
              label={t('calls.mute')}
              tone="neutral"
              disabled={!shown.media_ready}
              onPress={() => {}}
            />
            <RoundButton
              testID="call-speaker"
              icon={Volume2}
              label={t('calls.speaker')}
              tone="neutral"
              disabled={!shown.media_ready}
              onPress={() => {}}
            />
            {video ? (
              <RoundButton
                testID="call-camera"
                icon={Video}
                label={t('calls.camera')}
                tone="neutral"
                disabled={!shown.media_ready}
                onPress={() => {}}
              />
            ) : null}
          </View>
        ) : null}
        <View style={[styles.row, { gap: spacing.xxl }]}>
          {ringingIn && shown ? (
            <>
              <RoundButton
                testID="call-decline"
                icon={PhoneOff}
                label={t('calls.decline')}
                tone="hangup"
                onPress={tap(() => decline.mutate(shown.id))}
              />
              <RoundButton
                testID="call-accept"
                icon={video ? Video : Phone}
                label={t('calls.accept')}
                tone="accept"
                onPress={tap(() => accept.mutate(shown.id))}
              />
            </>
          ) : live && shown ? (
            <RoundButton
              testID="call-hangup"
              icon={PhoneOff}
              label={t('calls.hangUp')}
              tone="hangup"
              onPress={tap(() => end.mutate(shown.id))}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Full-screen call, always on ink like a phone's own call screen. */
export function CallScreen() {
  const { accent } = useTheme();
  return (
    <ThemeProvider scheme="dark" accent={accent}>
      <CallContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { alignItems: 'center', paddingHorizontal: 24 },
  center: { textAlign: 'center' },
  status: { fontSize: 17, fontVariant: ['tabular-nums'] },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { width: AVATAR, height: AVATAR, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
  },
  note: { textAlign: 'center', maxWidth: 300 },
  bottom: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  action: { alignItems: 'center', width: 84 },
  round: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
