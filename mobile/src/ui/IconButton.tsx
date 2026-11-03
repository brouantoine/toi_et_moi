import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET, type Palette } from './tokens';

type Variant = 'primary' | 'soft' | 'plain' | 'overlay';

type Props = {
  icon: LucideIcon;
  /** Required: an icon-only button must be named for screen readers. */
  label: string;
  onPress: () => void;
  variant?: Variant;
  testID?: string;
};

const VARIANTS: Record<Variant, { bg: keyof Palette | null; fg: keyof Palette }> = {
  primary: { bg: 'primary', fg: 'onPrimary' },
  soft: { bg: 'primarySoft', fg: 'onPrimarySoft' },
  plain: { bg: null, fg: 'text' },
  /** Over a photo: light icon on the dark scrim. */
  overlay: { bg: 'scrim', fg: 'onScrim' },
};

/** Round icon-only button, always at least MIN_TOUCH_TARGET wide. */
export function IconButton({ icon, label, onPress, variant = 'soft', testID }: Props) {
  const { colors, elevation } = useTheme();
  const { bg, fg } = VARIANTS[variant];
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.92}
      style={[
        styles.base,
        {
          backgroundColor: bg ? colors[bg] : 'transparent',
          boxShadow: variant === 'primary' ? elevation.card : undefined,
        },
      ]}
    >
      <Icon icon={icon} size={22} color={fg} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
