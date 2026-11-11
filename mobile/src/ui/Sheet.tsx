import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
};

/** Bottom sheet built on the native Modal (no extra dependency). */
export function Sheet({ visible, onClose, title, children, testID }: Props) {
  const { t } = useTranslation();
  const { colors, elevation, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const closeTestID = testID ? testID + '-close' : undefined;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      {/* The sheet rises with the keyboard (iOS; Android resizes the window itself), so a
          field inside it, e.g. a new note, is never hidden. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              // `surface`, not `background`: at night the sheet must stand out from the
              // black screen behind the veil (same white as the background by day).
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopWidth: elevation.hairline ? StyleSheet.hairlineWidth : 0,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
            <Text variant="heading" style={styles.title}>
              {title}
            </Text>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={4}
              scaleTo={0.9}
              style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
              testID={closeTestID}
            >
              <Icon icon={X} size={20} strokeWidth={2.2} />
            </PressableScale>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1 },
  sheet: { maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  close: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: (MIN_TOUCH_TARGET - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
