import { Hash, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, MIN_TOUCH_TARGET, Text, useTheme } from '@/ui';

import { addTag } from './memoryForm';

type Props = { value: string[]; onChange: (tags: string[]) => void };

/** Tags as removable pills; type a word and confirm (return or +) to add it. */
export function TagField({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = addTag(value, draft);
    if (next !== value) onChange(next);
    setDraft('');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{t('memories.form.tagsLabel')}</Text>
      {value.length ? (
        <View style={[styles.wrap, { gap: spacing.sm }]}>
          {value.map((tag) => (
            <View
              key={tag}
              style={[
                styles.tag,
                {
                  backgroundColor: colors.secondarySoft,
                  borderRadius: radii.pill,
                  paddingLeft: spacing.smd,
                },
              ]}
            >
              <Text variant="caption" color="onSecondarySoft" style={styles.tagText}>
                {`#${tag}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('memories.form.removeTag', { tag })}
                onPress={() => onChange(value.filter((v) => v !== tag))}
                hitSlop={8}
                style={styles.tagRemove}
              >
                <Icon icon={X} size={14} color="onSecondarySoft" strokeWidth={2.25} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.md,
            paddingLeft: spacing.smd,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon icon={Hash} size={18} color="textMuted" />
        <TextInput
          testID="memory-form-tag-input"
          accessibilityLabel={t('memories.form.tagsLabel')}
          accessibilityHint={t('memories.form.tagsHint')}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          submitBehavior="submit"
          returnKeyType="done"
          autoCapitalize="none"
          placeholder={t('memories.form.tagsPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, typography.body, { color: colors.text }]}
        />
        {draft.trim() ? (
          <Pressable
            testID="memory-form-tag-add"
            accessibilityRole="button"
            accessibilityLabel={t('memories.form.addTag')}
            onPress={commit}
            style={styles.addButton}
          >
            <Icon icon={Plus} size={20} color="primary" strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', height: 32, borderCurve: 'continuous' },
  tagText: { fontWeight: '600' },
  tagRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: MIN_TOUCH_TARGET, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 10 },
  addButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
