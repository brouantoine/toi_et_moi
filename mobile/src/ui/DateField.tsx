import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

/** "YYYY-MM-DD" from the local calendar day (no UTC shift). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local Date at noon for a "YYYY-MM-DD" string (noon avoids DST edge cases). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
}

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  maximumDate?: Date;
  clearable?: boolean;
  testID?: string;
};

export function DateField({ label, value, onChange, maximumDate, clearable, testID }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? fromIsoDate(value) : new Date());

  const display = value
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(fromIsoDate(value))
    : t('common.notSet');

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(toIsoDate(date));
      return;
    }
    if (date) setDraft(date);
  };

  const picker = (
    <DateTimePicker
      testID={testID ? `${testID}-picker` : undefined}
      value={draft}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={maximumDate}
      onChange={onPickerChange}
    />
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${display}`}
        onPress={() => {
          setDraft(value ? fromIsoDate(value) : new Date());
          setOpen(true);
        }}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: 'transparent',
            borderRadius: radii.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Text muted={!value} style={styles.value}>
          {display}
        </Text>
        <Icon icon={CalendarDays} size={20} color="textMuted" />
      </Pressable>
      {clearable && value ? (
        <Button
          testID={testID ? `${testID}-clear` : undefined}
          variant="ghost"
          label={t('common.clear')}
          onPress={() => onChange(null)}
        />
      ) : null}
      {open && Platform.OS === 'android' ? picker : null}
      {Platform.OS !== 'android' ? (
        <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
          {picker}
          <Button
            testID={testID ? `${testID}-confirm` : undefined}
            label={t('common.confirm')}
            onPress={() => {
              onChange(toIsoDate(draft));
              setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: { flex: 1 },
});
