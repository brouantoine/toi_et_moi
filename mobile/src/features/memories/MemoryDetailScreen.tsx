import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Heart, MapPin, Pencil, Quote, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import {
  BackButton,
  Button,
  ErrorState,
  fromIsoDate,
  Icon,
  IconButton,
  LoadingState,
  Notice,
  PressableScale,
  Text,
  usePop,
  useTheme,
} from '@/ui';

import { MemoryComments } from './MemoryComments';
import { MEMORY_TYPE_HUES, MEMORY_TYPE_ICONS } from './memoryTypes';
import { PhotoPager } from './PhotoPager';
import { useMemory, type Memory } from './useMemories';
import { useDeleteMemory, useToggleHeart } from './useMemoryDetail';

function HeartRow({ memory }: { memory: Memory }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const partner = usePartner();
  const toggle = useToggleHeart(memory.id);
  const on = memory.my_heart;
  const { style: popStyle, pop } = usePop();

  const partnerLine = memory.partner_heart
    ? on
      ? t('memories.detail.bothHearts')
      : t('memories.detail.partnerHeart', { name: partner?.display_name ?? '' })
    : null;

  return (
    <View style={[styles.heartRow, { gap: spacing.md }]}>
      <PressableScale
        testID="memory-heart"
        accessibilityRole="switch"
        accessibilityLabel={t('memories.detail.heartLabel')}
        accessibilityState={{ checked: on }}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          if (!on) pop();
          toggle.mutate(!on);
        }}
        scaleTo={0.94}
        hitSlop={{ top: 2, bottom: 2 }}
        style={[
          styles.heartPill,
          {
            backgroundColor: on ? colors.primarySoft : colors.surfaceMuted,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <Animated.View style={popStyle}>
          <Icon
            icon={Heart}
            size={20}
            color={on ? 'primary' : 'textMuted'}
            filled={on}
            strokeWidth={2}
          />
        </Animated.View>
        <Text variant="caption" color={on ? 'onPrimarySoft' : 'text'} style={styles.heartText}>
          {on ? t('memories.detail.heartOn') : t('memories.detail.heartOff')}
        </Text>
      </PressableScale>
      {partnerLine ? (
        <Text variant="caption" muted style={styles.flex} testID="memory-partner-heart">
          {partnerLine}
        </Text>
      ) : null}
    </View>
  );
}

function MemoryBody({ memory }: { memory: Memory }) {
  const { t, i18n } = useTranslation();
  const { colors, hues, radii, spacing } = useTheme();
  const type = memory.type ?? 'moment';
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' }).format(
    fromIsoDate(memory.happened_on),
  );
  const isQuote = type === 'quote' && Boolean(memory.body?.trim());
  const hue = hues[MEMORY_TYPE_HUES[type]];

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon icon={MEMORY_TYPE_ICONS[type]} size={16} tint={hue.fg} strokeWidth={2} />
          <Text variant="overline" style={{ color: hue.fg }}>
            {t(`memories.types.${type}`)}
          </Text>
        </View>
        <Text variant="display" testID="memory-title">
          {memory.title}
        </Text>
        <Text muted>{date.charAt(0).toLocaleUpperCase(i18n.language) + date.slice(1)}</Text>
        {memory.place ? (
          <View style={[styles.row, { gap: spacing.xs }]}>
            <Icon icon={MapPin} size={16} color="textMuted" />
            <Text muted>{memory.place}</Text>
          </View>
        ) : null}
      </View>

      {isQuote ? (
        <View
          style={[
            styles.quote,
            { borderLeftColor: hue.fg, paddingLeft: spacing.md, gap: spacing.sm },
          ]}
        >
          <Icon icon={Quote} size={24} tint={hue.fg} />
          <Text variant="quote">{memory.body}</Text>
        </View>
      ) : memory.body?.trim() ? (
        <Text variant="lead">{memory.body}</Text>
      ) : null}

      {memory.tags?.length ? (
        <View style={[styles.wrap, { gap: spacing.sm }]}>
          {memory.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: colors.secondarySoft,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.smd,
                paddingVertical: spacing.xs,
              }}
            >
              <Text variant="caption" color="onSecondarySoft" style={styles.tagText}>
                {`#${tag}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <HeartRow memory={memory} />
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <MemoryComments memoryId={memory.id} />
    </View>
  );
}

export function MemoryDetailScreen({ memoryId }: { memoryId: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const query = useMemory(memoryId);
  const remove = useDeleteMemory(memoryId);

  if (query.isPending) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LoadingState testID="memory-detail-loading" />
        <BackButton floating testID="memory-back" />
      </View>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <BackButton testID="memory-back" />
        </View>
        <ErrorState
          testID="memory-detail-error"
          code={query.error instanceof ApiError ? query.error.code : 'network'}
          onRetry={() => void query.refetch()}
        />
      </SafeAreaView>
    );
  }

  const memory = query.data;
  const hasPhotos = memory.photos.length > 0;

  const confirmDelete = () =>
    Alert.alert(t('memories.detail.deleteTitle'), t('memories.detail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);

  const actions = (variant: 'overlay' | 'plain') => (
    <View style={[styles.actions, { paddingHorizontal: spacing.md }]}>
      <BackButton testID="memory-back" />
      <IconButton
        testID="memory-edit"
        icon={Pencil}
        variant={variant}
        label={t('memories.detail.edit')}
        onPress={() => router.push(`/memories/${memory.id}/edit`)}
      />
    </View>
  );

  return (
    <View testID="memory-detail" style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: hasPhotos ? 0 : insets.top + 56,
            paddingBottom: insets.bottom + spacing.xl,
          }}
        >
          {hasPhotos ? <PhotoPager photos={memory.photos} /> : null}
          {remove.isError ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <Notice tone="warning" message={t('memories.detail.deleteError')} />
            </View>
          ) : null}
          <MemoryBody memory={memory} />
          {/* Destructive action kept low on the page, away from everyday controls. */}
          <View style={{ paddingHorizontal: spacing.lg, alignItems: 'center' }}>
            <Button
              testID="memory-delete"
              variant="ghost"
              icon={Trash2}
              label={t('memories.detail.delete')}
              loading={remove.isPending}
              onPress={confirmDelete}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + spacing.xs },
          hasPhotos ? null : { backgroundColor: colors.background },
        ]}
      >
        {actions(hasPhotos ? 'overlay' : 'plain')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quote: { borderLeftWidth: 2 },
  tagText: { fontWeight: '600' },
  heartRow: { flexDirection: 'row', alignItems: 'center' },
  heartPill: { flexDirection: 'row', alignItems: 'center', height: 44, borderCurve: 'continuous' },
  heartText: { fontWeight: '600' },
  rule: { height: StyleSheet.hairlineWidth },
});
