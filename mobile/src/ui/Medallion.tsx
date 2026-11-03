import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from './Icon';
import { useTheme } from './theme';
import type { Palette } from './tokens';

type Tone = 'sage' | 'terracotta' | 'neutral';

const TONES: Record<Tone, { bg: keyof Palette; fg: keyof Palette }> = {
  sage: { bg: 'secondarySoft', fg: 'onSecondarySoft' },
  terracotta: { bg: 'primarySoft', fg: 'onPrimarySoft' },
  neutral: { bg: 'surfaceMuted', fg: 'textMuted' },
};

type Props = { icon: LucideIcon; tone?: Tone; size?: number };

/** Decorative icon set in a soft tinted circle (empty and error states, settings tiles). */
export function Medallion({ icon, tone = 'sage', size = 88 }: Props) {
  const { colors } = useTheme();
  const { bg, fg } = TONES[tone];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors[bg],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon icon={icon} size={Math.round(size * 0.4)} color={fg} strokeWidth={1.5} />
    </View>
  );
}
