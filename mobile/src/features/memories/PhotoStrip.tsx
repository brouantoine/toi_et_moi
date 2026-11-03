import { Image } from 'expo-image';
import { AlertCircle, ImagePlus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, MIN_TOUCH_TARGET, PressableScale, Text, useTheme } from '@/ui';

import { MAX_PHOTOS } from './memoryForm';

export type StripPhoto = { key: string; uri: string; failed?: boolean };

type Props = {
  photos: StripPhoto[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
};

const TILE = 104;

/** Horizontal strip of the memory's photos, with an "add" tile while under the limit. */
export function PhotoStrip({ photos, onAdd, onRemove, disabled }: Props) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const canAdd = photos.length < MAX_PHOTOS && !disabled;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.headerRow}>
        <Text variant="overline" muted style={styles.flex}>
          {t('memories.form.photosLabel')}
        </Text>
        <Text variant="caption" muted testID="memory-form-photo-count">
          {t('memories.form.photosCount', { count: photos.length, max: MAX_PHOTOS })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.smd, paddingHorizontal: spacing.lg }}
        style={{ marginHorizontal: -spacing.lg }}
      >
        {canAdd ? (
          <PressableScale
            testID="memory-form-add-photos"
            accessibilityRole="button"
            accessibilityLabel={t('memories.form.addPhotos')}
            onPress={onAdd}
            style={[
              styles.tile,
              styles.addTile,
              {
                borderRadius: radii.md,
                borderColor: colors.primary,
                backgroundColor: colors.primarySoft,
                gap: spacing.xs,
              },
            ]}
          >
            <Icon icon={ImagePlus} size={26} color="onPrimarySoft" />
            <Text variant="caption" color="onPrimarySoft" style={styles.addLabel}>
              {t('memories.form.addPhotosShort')}
            </Text>
          </PressableScale>
        ) : null}
        {photos.map((photo, index) => (
          <View key={photo.key} style={styles.tile}>
            <Image
              source={{ uri: photo.uri }}
              style={[
                styles.tile,
                { borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
                photo.failed && { opacity: 0.55 },
              ]}
              contentFit="cover"
              transition={150}
              accessibilityLabel={t('memories.form.photoN', { n: index + 1 })}
            />
            {photo.failed ? (
              <View
                style={[styles.failed, { backgroundColor: colors.scrim, borderRadius: radii.md }]}
                accessible
                accessibilityLabel={t('memories.form.photoFailed')}
              >
                <Icon icon={AlertCircle} size={22} color="onScrim" />
              </View>
            ) : null}
            {disabled ? null : (
              <Pressable
                testID={`memory-form-remove-photo-${index}`}
                accessibilityRole="button"
                accessibilityLabel={t('memories.form.removePhoto', { n: index + 1 })}
                onPress={() => onRemove(photo.key)}
                hitSlop={8}
                style={styles.removeHit}
              >
                <View style={[styles.removeDot, { backgroundColor: colors.scrim }]}>
                  <Icon icon={X} size={14} color="onScrim" strokeWidth={2.5} />
                </View>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  tile: { width: TILE, height: TILE, borderCurve: 'continuous' },
  addTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontWeight: '600' },
  failed: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  removeHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    alignItems: 'flex-end',
    padding: 6,
  },
  removeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
