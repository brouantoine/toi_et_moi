import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { ChevronDown, ImagePlus, MessageCircleHeart, Mic, Send } from 'lucide-react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { setConversationOpen } from '@/notifications/setup';
import {
  BolingoLoader,
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

import {
  dayKey,
  DaySeparator,
  formatDuration,
  MessageBubble,
  TypingBubble,
} from './MessageBubbles';
import { PhotoViewer } from './PhotoViewer';
import { reportTyping, useTypingStore } from './typing';
import {
  retryFailed,
  useMarkRead,
  useMessageActions,
  useMessages,
  useOutbox,
  type Message,
} from './useMessages';
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
 * Sits the composer right on top of the keyboard, like WhatsApp.
 * iOS: the keyboard height minus what already lies under this screen (the floating tab
 * bar), animated with the keyboard itself.
 * Android (edge-to-edge, the window is not always resized): the part of this area the
 * keyboard really covers, measured, so it never pads twice when the system did resize.
 */
type ViewRef = ComponentRef<typeof View>;

function useKeyboardPadding(occupiedBelow: number, area: RefObject<ViewRef | null>) {
  const [padding] = useState(() => new Animated.Value(0));
  const keyboardTop = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const top = keyboardTop.current;
    if (top === null) {
      padding.setValue(0);
      return;
    }
    area.current?.measureInWindow((_x, y, _width, height) => {
      if (keyboardTop.current === null) return;
      padding.setValue(Math.max(0, y + height - keyboardTop.current));
    });
  }, [area, padding]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const show = Keyboard.addListener('keyboardDidShow', (event) => {
        keyboardTop.current = event.endCoordinates.screenY;
        measure();
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        padding.setValue(0);
      });
      return () => {
        show.remove();
        hide.remove();
      };
    }
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
  }, [occupiedBelow, padding, measure]);
  // The area moves when the tab bar hides for the keyboard: measure again.
  return { padding, onLayout: measure };
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

function Composer({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const { sendText, sendPhoto, sendVoice } = useMessageActions();
  const voice = useVoiceRecorder();
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [photoDenied, setPhotoDenied] = useState(false);
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
    onSent();
  };

  const addPhoto = () => {
    setPhotoDenied(false);
    guard(
      pickImages(1).then((result) => {
        if (result.status === 'denied') setPhotoDenied(true);
        if (result.status !== 'picked' || !result.images[0]) return undefined;
        onSent();
        return sendPhoto(result.images[0]);
      }),
    );
  };

  /** Finger down on the mic: record at once. */
  const pressIn = (pageX: number) => {
    startX.current = pageX;
    cancelled.current = false;
    setSlide(0);
    setHint(false);
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void voice.start().catch(() => false);
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
    onSent();
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
      {photoDenied ? (
        <Notice
          testID="photo-denied"
          tone="warning"
          message={t('messages.photoDenied')}
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

/** Scrolled this far up into the history, a button brings back the latest message. */
const JUMP_THRESHOLD = 600;

/** The couple's private thread: read receipts and "typing…", like WhatsApp. */
export function MessagesScreen() {
  const { i18n, t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const thread = useMessages();
  const failed = useOutbox((state) => state.failed);
  const { remove } = useMessageActions();
  const insets = useSafeAreaInsets();
  const area = useRef<ViewRef>(null);
  const list = useRef<FlatList<Message>>(null);
  const keyboard = useKeyboardPadding(floatingTabBarHeight(insets.bottom), area);
  const partner = usePartner();
  const partnerTyping = useTypingStore((state) => state.partnerTyping);
  const [focused, setFocused] = useState(false);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [farFromLatest, setFarFromLatest] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      // No banner for a message I am already reading.
      setConversationOpen(true);
      return () => {
        setFocused(false);
        setConversationOpen(false);
      };
    }, []),
  );
  useMarkRead(thread.messages, focused);

  const failedIds = useMemo(() => new Set(failed.map((f) => f.message.id)), [failed]);
  // Newest first, like the thread: what did not go stays at the bottom, where it was typed.
  const messages = useMemo(
    () => [...failed.map((f) => f.message), ...thread.messages],
    [failed, thread.messages],
  );

  const scrollToLatest = () => list.current?.scrollToOffset({ offset: 0, animated: true });

  const confirmDelete = (message: Message) =>
    Alert.alert(t('messages.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('messages.delete'),
        style: 'destructive',
        onPress: () => void remove(message).catch(() => Alert.alert(t('messages.deleteFailed'))),
      },
    ]);

  /** Long press: copy a text, delete my own (sent) message. */
  const openOptions = (message: Message) => {
    const mine = message.author === 'me';
    const copyable = message.kind === 'text' && !!message.text;
    const deletable = mine && message.id > 0;
    if (!copyable && !deletable) return;
    void Haptics.selectionAsync().catch(() => {});
    Alert.alert(t('messages.optionsTitle'), undefined, [
      ...(copyable
        ? [
            {
              text: t('messages.copy'),
              onPress: () => void Clipboard.setStringAsync(message.text).catch(() => false),
            },
          ]
        : []),
      ...(deletable
        ? [
            {
              text: t('messages.delete'),
              style: 'destructive' as const,
              onPress: () => confirmDelete(message),
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  /** Tap on a message that did not go: send it again, or let it go. */
  const offerRetry = (message: Message) =>
    Alert.alert(t('messages.notSentTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('messages.discard'),
        style: 'destructive',
        onPress: () => void remove(message),
      },
      {
        text: t('common.retry'),
        onPress: () => {
          scrollToLatest();
          void retryFailed(message.id);
        },
      },
    ]);

  let body;
  if (thread.isPending && failed.length === 0) {
    body = (
      <View testID="messages-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width="60%" height={44} radius={radii.lg} />
        <View style={styles.rightSkeleton}>
          <Skeleton width="50%" height={44} radius={radii.lg} />
        </View>
      </View>
    );
  } else if (thread.isError && messages.length === 0) {
    body = (
      <ErrorState
        testID="messages-error"
        code={thread.error instanceof ApiError ? thread.error.code : 'network'}
        error={thread.error}
        onRetry={() => void thread.refetch()}
      />
    );
  } else if (messages.length === 0 && !partnerTyping) {
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
      <>
        <FlatList
          ref={list}
          testID="messages-list"
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item, index }) => {
            const isFailed = failedIds.has(item.id);
            const older = messages[index + 1];
            // Inverted list: the first message of a day carries the day above it.
            const firstOfDay = !older || dayKey(older.created_at) !== dayKey(item.created_at);
            return (
              <View>
                {firstOfDay && (older || !thread.hasNextPage) ? (
                  <DaySeparator iso={item.created_at} />
                ) : null}
                <MessageBubble
                  message={item}
                  failed={isFailed}
                  onPress={
                    isFailed
                      ? () => offerRetry(item)
                      : item.kind === 'photo' && item.media_url
                        ? () => setViewing(item)
                        : undefined
                  }
                  onLongPress={isFailed ? () => offerRetry(item) : () => openOptions(item)}
                />
              </View>
            );
          }}
          extraData={`${failedIds.size}-${i18n.language}`}
          contentContainerStyle={{ padding: spacing.md }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => setFarFromLatest(event.nativeEvent.contentOffset.y > JUMP_THRESHOLD)}
          scrollEventThrottle={100}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
          }}
          // Inverted list: the header sits at the bottom, right under the newest message.
          ListHeaderComponent={
            partnerTyping ? (
              <TypingBubble name={partner?.display_name || t('messages.fromPartner')} />
            ) : undefined
          }
          ListFooterComponent={
            thread.isFetchingNextPage ? (
              <BolingoLoader testID="messages-older-loading" size={28} style={styles.older} />
            ) : undefined
          }
        />
        {farFromLatest ? (
          <View style={[styles.jump, { right: spacing.md, bottom: spacing.md }]}>
            <IconButton
              testID="messages-jump-latest"
              icon={ChevronDown}
              variant="soft"
              label={t('messages.scrollToLatest')}
              onPress={scrollToLatest}
            />
          </View>
        ) : null}
      </>
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
      <View ref={area} style={styles.root} onLayout={keyboard.onLayout}>
        <Animated.View style={[styles.root, { paddingBottom: keyboard.padding }]}>
          <View style={styles.root}>{body}</View>
          <Composer onSent={scrollToLatest} />
        </Animated.View>
      </View>
      <PhotoViewer message={viewing} onClose={() => setViewing(null)} />
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
  older: { alignSelf: 'center', marginVertical: 8 },
  jump: { position: 'absolute' },
});
