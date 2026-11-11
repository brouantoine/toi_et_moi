import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { accents, ACCENT_IDS, Icon, PressableScale, Text, useTheme, type AccentId } from '@/ui';

const SWATCH = 44;

type Props = { value: AccentId; onChange: (accent: AccentId) => void };

/** The couple's colour: one tap applies it at once, for both partners. */
export function AccentPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, scheme, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{t('coupleInfo.colorTitle')}</Text>
      <View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.smd }]}>
        {ACCENT_IDS.map((id) => {
          const swatch = accents[id][scheme];
          const selected = id === value;
          return (
            <PressableScale
              key={id}
              testID={`accent-${id}`}
              accessibilityRole="radio"
              accessibilityLabel={t(`coupleInfo.colors.${id}`)}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                onChange(id);
              }}
              style={[styles.ring, { borderColor: selected ? swatch.primary : colors.border }]}
            >
              <View style={[styles.swatch, { backgroundColor: swatch.primary }]}>
                {selected ? (
                  <Icon icon={Check} size={20} tint={swatch.onPrimary} strokeWidth={3} />
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Text variant="caption" muted>
        {t('coupleInfo.colorHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  ring: {
    width: SWATCH + 8,
    height: SWATCH + 8,
    borderRadius: (SWATCH + 8) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
