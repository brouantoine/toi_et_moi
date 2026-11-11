import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, palettes, useTheme } from '@/ui';

import type { Message } from './useMessages';

/** A photo of the thread, full screen on black (like any photo viewer, day or night). */
export function PhotoViewer({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const uri = message?.media_url ?? null;
  return (
    <Modal
      visible={uri !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        testID="photo-viewer"
        accessibilityViewIsModal
        style={[styles.root, { backgroundColor: palettes.dark.background }]}
      >
        {uri && message ? (
          <Image
            source={message.id > 0 ? { uri, cacheKey: `message-photo-${message.id}` } : { uri }}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel={t('messages.photoLabel')}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={[styles.close, { top: insets.top + spacing.sm, right: spacing.md }]}>
          <IconButton
            testID="photo-viewer-close"
            icon={X}
            variant="overlay"
            label={t('common.close')}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photo: { flex: 1 },
  close: { position: 'absolute' },
});
