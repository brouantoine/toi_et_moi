import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from './theme';

/**
 * The couple's colour washing down from the top of a main screen and fading into the
 * background, like light through a window. Decorative: never under interactive layers.
 */
export function ScreenWash({ height = 380 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.wash, { height }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.wash} stopOpacity={1} />
            <Stop offset="0.55" stopColor={colors.wash} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },
});
