import { Image } from 'expo-image';
import { Images, MapPin, Quote } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { fromIsoDate, Icon, PressableScale, Text, useSurfaceStyle, useTheme } from '@/ui';

import { MEMORY_TYPE_ICONS } from './memoryTypes';
import type { Memory } from './useMemories';

type Props = { memory: Memory; onPress: (id: number) => void };

function TypePill({ type }: { type: NonNullable<Memory['type']> }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.secondarySoft,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.smd - 2,
          gap: spacing.xs + 1,
        },
      ]}
    >
      <Icon icon={MEMORY_TYPE_ICONS[type]} size={14} color="onSecondarySoft" strokeWidth={2} />
      <Text variant="overline" color="onSecondarySoft">
        {t(`memories.types.${type}`)}
      </Text>
    </View>
  );
}

function MemoryCardBase({ memory, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const type = memory.type ?? 'moment';
  const isQuote = type === 'quote';
  const cover = isQuote ? undefined : memory.photos[0];
  const extraPhotos = Math.max(memory.photos.length - 1, 0);
  const excerpt = memory.body?.trim();
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
    fromIsoDate(memory.happened_on),
  );

  return (
    <PressableScale
      testID={`memory-card-${memory.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${memory.title}, ${date}`}
      onPress={() => onPress(memory.id)}
      style={[surface, styles.card, { borderRadius: radii.lg }]}
    >
      <View style={[styles.clip, { borderRadius: radii.lg }]}>
        {cover ? (
          <View>
            <Image
              source={{ uri: cover.thumbnail_url ?? cover.url ?? undefined }}
              style={[styles.cover, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={String(cover.id)}
              accessibilityIgnoresInvertColors
            />
            {extraPhotos > 0 ? (
              <View
                accessible
                accessibilityLabel={t('memories.morePhotos', { count: extraPhotos })}
                style={[
                  styles.photoBadge,
                  {
                    backgroundColor: colors.scrim,
                    borderRadius: radii.pill,
                    paddingHorizontal: spacing.sm,
                    gap: spacing.xs,
                    margin: spacing.smd,
                  },
                ]}
              >
                <Icon icon={Images} size={14} color="onScrim" strokeWidth={2} />
                <Text variant="caption" color="onScrim" style={styles.badgeText}>
                  {`+${extraPhotos}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ padding: spacing.md + 2, gap: spacing.sm }}>
          {isQuote ? null : <TypePill type={type} />}
          {isQuote ? (
            <View style={{ gap: spacing.sm }}>
              <Icon icon={Quote} size={22} color="primary" strokeWidth={1.75} />
              <Text variant="quote" numberOfLines={5}>
                {excerpt || memory.title}
              </Text>
              {excerpt ? (
                <Text variant="caption" muted numberOfLines={1}>
                  {memory.title}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text variant="heading" numberOfLines={2}>
                {memory.title}
              </Text>
              {excerpt ? (
                <Text muted numberOfLines={2}>
                  {excerpt}
                </Text>
              ) : null}
            </>
          )}
          {memory.place ? (
            <View style={[styles.row, { gap: spacing.xs }]}>
              <Icon icon={MapPin} size={14} color="textMuted" />
              <Text variant="caption" muted numberOfLines={1} style={styles.flex}>
                {memory.place}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export const MemoryCard = memo(MemoryCardBase);

const styles = StyleSheet.create({
  // The shadow lives on the outer surface; clipping happens inside so iOS keeps it.
  card: { borderCurve: 'continuous' },
  clip: { overflow: 'hidden', borderCurve: 'continuous' },
  cover: { width: '100%', aspectRatio: 4 / 3 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', height: 26 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: { fontWeight: '600' },
});
