import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = {
  label: string;
  /** "HH:MM" (24 h). */
  value: string;
  onChange: (value: string) => void;
  testID?: string;
};

function toDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 12, m ?? 0, 0, 0);
  return d;
}

function toValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Time picker field, same look and behaviour as DateField. */
export function TimeField({ label, value, onChange, testID }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDate(value));
  const display = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(toValue(date));
      return;
    }
    if (date) setDraft(date);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${display}`}
        onPress={() => {
          setDraft(toDate(value));
          setOpen(true);
        }}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Text style={styles.value}>{display}</Text>
        <Icon icon={Clock} size={20} color="textMuted" />
      </Pressable>
      {open ? (
        <View style={{ gap: spacing.sm }}>
          <DateTimePicker
            testID={testID ? `${testID}-picker` : undefined}
            value={draft}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label={t('common.confirm')}
              variant="soft"
              onPress={() => {
                onChange(toValue(draft));
                setOpen(false);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  value: { flex: 1 },
});
