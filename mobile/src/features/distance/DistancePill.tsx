import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Icon, PressableScale, Text, useTheme, type Palette } from '@/ui';

import { formatKm } from './format';
import { useDistance } from './useDistance';

type Props = { tone: keyof Palette };

/** Under the days together: "45 km", opens the map screen. */
export function DistancePill({ tone }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { radii, spacing } = useTheme();
  const { data } = useDistance();
  const km = data?.km;
  const label = km == null ? t('distance.pillShow') : formatKm(km, i18n.language);
  return (
    <PressableScale
      testID="distance-pill"
      accessibilityRole="button"
      accessibilityLabel={km == null ? label : t('distance.pillLabel', { km: label })}
      onPress={() => router.push('/distance')}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[styles.pill, { gap: spacing.xs, borderRadius: radii.pill }]}
    >
      <Icon icon={MapPin} size={16} color={tone} strokeWidth={2.2} />
      <Text variant="caption" color={tone} style={styles.text}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  text: { fontWeight: '700' },
});
