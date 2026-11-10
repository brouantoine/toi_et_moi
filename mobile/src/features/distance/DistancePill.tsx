import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Icon, PressableScale, Text, useTheme } from '@/ui';

import { formatKm } from './format';
import { useDistance } from './useDistance';

/** "6 km" between the two avatars: a white capsule that opens the map. */
export function DistancePill() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, elevation, radii, spacing } = useTheme();
  const { data } = useDistance();
  const km = data?.km;
  const label = km == null ? t('distance.pillShow') : formatKm(km, i18n.language);
  return (
    <PressableScale
      testID="distance-pill"
      accessibilityRole="button"
      accessibilityLabel={km == null ? label : t('distance.pillLabel', { km: label })}
      onPress={() => router.push('/distance')}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={[
        styles.pill,
        {
          gap: spacing.xs,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.smd,
          backgroundColor: colors.surface,
          boxShadow: elevation.card,
        },
      ]}
    >
      <Icon icon={MapPin} size={14} color="primary" strokeWidth={2.4} />
      <Text variant="caption" style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', height: 32 },
  text: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
