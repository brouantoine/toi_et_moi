import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { ImagePlus, MessageCircleHeart, Mic, Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import { floatingTabBarHeight } from '@/features/shell/FloatingTabBar';
import { pickImages } from '@/media/images';
import {
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  MIN_TOUCH_TARGET,
  Notice,
  Skeleton,
  Text,
  useReducedMotion,
  useTheme,
} from '@/ui';

import { formatDuration, MessageBubble, TypingBubble } from './MessageBubbles';
import { reportTyping, useTypingStore } from './typing';
import { useMarkRead, useMessageActions, useMessages, type Message } from './useMessages';
import { useVoiceRecorder } from './useVoiceRecorder';
import { Waveform } from './Waveform';

function RecordingTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <Text testID="recording-timer" variant="label" color="primary" style={styles.tabular}>
      {formatDuration(startedAt ? Math.max(0, now - startedAt) : 0)}
    </Text>
  );
}

/** Sliding the finger this far to the left while recording throws the note away. */
export const CANCEL_SLIDE = 90;

/**
 * Sits the composer right on top of the keyboard, like WhatsApp: the padding is the
 * keyboard height minus what already lies under this screen (the floating tab bar),
 * animated with the keyboard itself. Android resizes the window on its own.
 */
function useKeyboardPadding(occupiedBelow: number) {
  const [padding] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const move = (to: number, duration?: number) =>
      Animated.timing(padding, {
        toValue: to,
        duration: duration || 250,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
        useNativeDriver: false,
      }).start();
    const show = Keyboard.addListener('keyboardWillShow', (event) =>
      move(Math.max(0, event.endCoordinates.height - occupiedBelow), event.duration),
    );
    const hide = Keyboard.addListener('keyboardWillHide', (event) => move(0, event.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [occupiedBelow, padding]);
  return padding;
}

/** Live bars of the microphone level while recording. */
function LiveWave({ levels }: { levels: number[] }) {
  const { colors } = useTheme();
  const bars = levels.length ? levels : [0];
  return (
    <View style={[styles.flex, styles.liveWave]}>
      <Waveform
        bars={bars}
        progress={1}
        played={colors.primary}
        idle={colors.primary}
        height={26}
      />
    </View>
  );
}

function Composer() {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const { sendText, sendPhoto, sendVoice } = useMessageActions();
  const voice = useVoiceRecorder();
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);
  const [slide, setSlide] = useState(0);
  const [holding, setHolding] = useState(false);
  const startX = useRef(0);
  const cancelled = useRef(false);
  const recording = voice.state === 'recording' || holding;
  const willCancel = slide <= -CANCEL_SLIDE;

  const guard = (task: Promise<unknown>) => {
    setFailed(false);
    void task.catch(() => setFailed(true));
  };

  const onChangeText = (value: string) => {
    setText(value);
    reportTyping(value.trim().length > 0);
  };
  // Leaving the conversation always ends "typing…" on the other phone.
  useEffect(() => () => reportTyping(false), []);

  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    reportTyping(false);
    guard(sendText(clean));
  };

  const addPhoto = () =>
    guard(
      pickImages(1).then((result) => {
        if (result.status === 'picked' && result.images[0]) return sendPhoto(result.images[0]);
        return undefined;
      }),
    );

  /** Finger down on the mic: record at once. */
  const pressIn = (pageX: number) => {
    startX.current = pageX;
    cancelled.current = false;
    setSlide(0);
    setHint(false);
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void voice.start();
  };

  /** Finger up: send, unless it slid away to cancel or was just a tap. */
  const pressOut = async () => {
    setHolding(false);
    setSlide(0);
    if (cancelled.current) {
      await voice.cancel();
      return;
    }
    const note = await voice.stop();
    if (!note) {
      setHint(true);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    guard(sendVoice(note.uri, note.durationMs, note.waveform));
  };

  const move = (pageX: number) => {
    const dx = Math.min(0, pageX - startX.current);
    setSlide(dx);
    const beyond = dx <= -CANCEL_SLIDE;
    if (beyond !== cancelled.current) {
      cancelled.current = beyond;
      void Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <View
      style={[
        styles.composerWrap,
        {
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          gap: spacing.sm,
        },
      ]}
    >
      {voice.state === 'denied' ? (
        <Notice
          testID="mic-denied"
          tone="warning"
          message={t('messages.micDenied')}
          actionLabel={t('memories.form.openSettings')}
          onAction={() => void Linking.openSettings()}
        />
      ) : null}
      {failed ? (
        <Notice testID="send-failed" tone="warning" message={t('messages.sendFailed')} />
      ) : null}
      {hint && !recording ? (
        <Text testID="record-hint" variant="caption" muted style={styles.center}>
          {t('messages.holdToRecord')}
        </Text>
      ) : null}
      <View style={[styles.composer, { gap: spacing.xs }]}>
        {recording ? (
          <View
            testID="recording-bar"
            style={[
              styles.field,
              styles.recording,
              {
                backgroundColor: willCancel ? colors.surfaceMuted : colors.primarySoft,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.md,
                gap: spacing.sm,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <RecordingTimer startedAt={voice.startedAt.current} />
            {willCancel ? (
              <Text testID="release-to-cancel" color="danger" style={[styles.flex, styles.bold]}>
                {t('messages.releaseToCancel')}
              </Text>
            ) : (
              <>
                <LiveWave levels={voice.live} />
                <Text
                  variant="caption"
                  muted
                  style={{ transform: [{ translateX: reduced ? 0 : slide / 2 }] }}
                >
                  {`‹ ${t('messages.slideToCancel')}`}
                </Text>
              </>
            )}
          </View>
        ) : (
          <>
            <IconButton
              testID="message-photo"
              icon={ImagePlus}
              variant="plain"
              label={t('messages.addPhoto')}
              onPress={addPhoto}
            />
            <View
              style={[
                styles.field,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              <TextInput
                testID="message-input"
                accessibilityLabel={t('messages.inputLabel')}
                placeholder={t('messages.placeholder')}
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={onChangeText}
                multiline
                maxLength={2000}
                style={[typography.body, styles.input, { color: colors.text }]}
              />
            </View>
          </>
        )}
        {text.trim() && !recording ? (
          <IconButton
            testID="message-send"
            icon={Send}
            variant="primary"
            label={t('messages.send')}
            onPress={send}
          />
        ) : (
          <Pressable
            testID="message-record"
            accessibilityRole="button"
            accessibilityLabel={t('messages.recordHint')}
            accessibilityHint={t('messages.holdToRecord')}
            onPressIn={(event) => pressIn(event.nativeEvent.pageX)}
            onPressOut={() => void pressOut()}
            onTouchMove={(event) => move(event.nativeEvent.pageX)}
            // Keep the press alive however far the finger travels (slide to cancel).
            pressRetentionOffset={{ top: 400, bottom: 400, left: 400, right: 400 }}
            hitSlop={8}
            style={[
              styles.mic,
              {
                backgroundColor: recording ? colors.primary : colors.primarySoft,
                transform: [{ scale: recording && !reduced ? 1.25 : 1 }],
              },
            ]}
          >
            <Icon icon={Mic} size={22} color={recording ? 'onPrimary' : 'onPrimarySoft'} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The couple's private thread. No read receipts, no "online", no typing indicator. */
export function MessagesScreen() {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const thread = useMessages();
  const { remove } = useMessageActions();
  const insets = useSafeAreaInsets();
  const keyboardPadding = useKeyboardPadding(floatingTabBarHeight(insets.bottom));
  const partner = usePartner();
  const partnerTyping = useTypingStore((state) => state.partnerTyping);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useMarkRead(thread.messages, focused);

  const confirmDelete = (message: Message) =>
    Alert.alert(t('messages.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => void remove(message),
      },
    ]);

  let body;
  if (thread.isPending) {
    body = (
      <View testID="messages-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width="60%" height={44} radius={radii.lg} />
        <View style={styles.rightSkeleton}>
          <Skeleton width="50%" height={44} radius={radii.lg} />
        </View>
      </View>
    );
  } else if (thread.isError && thread.messages.length === 0) {
    body = (
      <ErrorState
        testID="messages-error"
        code={thread.error instanceof ApiError ? thread.error.code : 'network'}
        error={thread.error}
        onRetry={() => void thread.refetch()}
      />
    );
  } else if (thread.messages.length === 0) {
    body = (
      <EmptyState
        testID="messages-empty"
        icon={MessageCircleHeart}
        title={t('messages.emptyTitle')}
        message={t('messages.emptyMessage')}
      />
    );
  } else {
    body = (
      <FlatList
        testID="messages-list"
        inverted
        data={thread.messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <MessageBubble message={item} onLongPress={() => confirmDelete(item)} />
        )}
        contentContainerStyle={{ padding: spacing.md }}
        keyboardDismissMode="interactive"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
        }}
        // Inverted list: the header sits at the bottom, right under the newest message.
        ListHeaderComponent={
          partnerTyping ? <TypingBubble name={partner?.display_name ?? ''} /> : undefined
        }
        ListFooterComponent={
          thread.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView
      testID="tab-us"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}
      >
        <Text variant="overline" color="primary">
          {t('messages.eyebrow')}
        </Text>
        <Text variant="title">{t('tabs.us.title')}</Text>
      </View>
      <Animated.View style={[styles.root, { paddingBottom: keyboardPadding }]}>
        <View style={styles.root}>{body}</View>
        <Composer />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end' },
  field: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  recording: { flexDirection: 'row', alignItems: 'center' },
  input: { maxHeight: 120, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mic: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveWave: { overflow: 'hidden', alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
  rightSkeleton: { alignItems: 'flex-end' },
});
