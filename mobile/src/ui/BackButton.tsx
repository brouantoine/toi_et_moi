import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { useTheme } from './theme';

type Props = {
  /** Over a screen without a navigation bar: pinned top-left, under the status bar. */
  floating?: boolean;
  onPress?: () => void;
  testID?: string;
};

/**
 * Round back button, the same everywhere. Goes back in the stack, or home when the
 * screen was opened directly (deep link, notification).
 */
export function BackButton({ floating = false, onPress, testID = 'back-button' }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, elevation, spacing } = useTheme();
  const back = onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const button = (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={back}
      hitSlop={8}
      scaleTo={0.9}
      style={[
        styles.button,
        { backgroundColor: colors.surface, boxShadow: elevation.card, borderColor: colors.border },
      ]}
    >
      <Icon icon={ChevronLeft} size={24} color="text" strokeWidth={2.4} />
    </PressableScale>
  );
  if (!floating) return button;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.floating, { top: insets.top + spacing.xs, left: spacing.md }]}
    >
      {button}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  floating: { position: 'absolute', zIndex: 10 },
});
