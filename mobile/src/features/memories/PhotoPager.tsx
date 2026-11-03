import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/ui';

import type { Memory } from './useMemories';

type Photo = Memory['photos'][number];

/** Full-bleed swipeable photos (4:5) with discreet page dots. */
export function PhotoPager({ photos }: { photos: Photo[] }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const height = Math.round((width * 5) / 4);

  return (
    <View testID="memory-photos">
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.id)}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item, index }) => (
          <Image
            source={{ uri: item.url ?? item.thumbnail_url ?? undefined }}
            placeholder={item.thumbnail_url ? { uri: item.thumbnail_url } : undefined}
            style={{ width, height, backgroundColor: colors.surfaceMuted }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            accessibilityLabel={t('memories.detail.photoOf', {
              n: index + 1,
              total: photos.length,
            })}
            accessibilityIgnoresInvertColors
          />
        )}
      />
      {photos.length > 1 ? (
        <View
          style={[styles.dots, { bottom: spacing.md, gap: spacing.xs + 2 }]}
          importantForAccessibility="no-hide-descendants"
        >
          {photos.map((p, index) => (
            <View
              key={p.id}
              style={[
                styles.dot,
                {
                  backgroundColor: colors.onScrim,
                  opacity: index === page ? 1 : 0.5,
                  width: index === page ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: { height: 6, borderRadius: 3 },
});
