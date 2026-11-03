import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from './theme';
import type { Palette } from './tokens';

type Props = {
  /** A Lucide icon component, e.g. `Heart` from 'lucide-react-native'. */
  icon: LucideIcon;
  size?: number;
  color?: keyof Palette;
  strokeWidth?: number;
  /** Fill the shape with the same color (e.g. a full heart). */
  filled?: boolean;
  /** When set, the icon is announced by screen readers; otherwise it is decorative. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The ONLY way to show an icon in the app: Lucide line icons, themed.
 * Emoji are never used as icons (see docs/DECISIONS.md).
 */
export function Icon({
  icon: LucideComponent,
  size = 24,
  color = 'text',
  strokeWidth = 1.75,
  filled = false,
  accessibilityLabel,
  testID,
}: Props) {
  const { colors } = useTheme();
  const labelled = Boolean(accessibilityLabel);
  return (
    <LucideComponent
      testID={testID}
      size={size}
      color={colors[color]}
      strokeWidth={strokeWidth}
      fill={filled ? colors[color] : 'none'}
      aria-hidden={!labelled}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
    />
  );
}
