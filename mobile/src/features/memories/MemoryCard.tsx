import { Image } from 'expo-image';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { fromIsoDate, Icon, Text, useTheme } from '@/ui';

import { MEMORY_TYPE_ICONS } from './memoryTypes';
import type { Memory } from './useMemories';

type Props = { memory: Memory; onPress: (id: number) => void };

function MemoryCardBase({ memory, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const type = memory.type ?? 'moment';
  const cover = memory.photos[0];
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
    fromIsoDate(memory.happened_on),
  );

  return (
    <Pressable
      testID={`memory-card-${memory.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${memory.title}, ${date}`}
      onPress={() => onPress(memory.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {cover?.thumbnail_url ? (
        <Image
          source={{ uri: cover.thumbnail_url }}
          style={[styles.cover, { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={String(cover.id)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon icon={MEMORY_TYPE_ICONS[type]} size={18} color="secondary" />
          <Text variant="caption" muted>
            {t(`memories.types.${type}`)} · {date}
          </Text>
        </View>
        <Text variant="heading">{memory.title}</Text>
        {memory.place ? (
          <Text variant="caption" muted>
            {memory.place}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const MemoryCard = memo(MemoryCardBase);

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 4 / 3 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
