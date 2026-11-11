import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion, useTheme } from './theme';

type Props = {
  /** Size in dp. */
  size?: number;
  /** Full cycle in ms. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Inside a container that already announces the loading. */
  decorative?: boolean;
};

/**
 * The Bolingo loader (brand asset): two balls, red and white (ink on a light screen),
 * turning together, meeting, then parting. Native-driver animation only.
 */
export function BolingoLoader({
  size = 56,
  duration = 1400,
  style,
  testID,
  decorative = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  const [spread] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) return;
    const ease = Easing.inOut(Easing.cubic);
    const half = duration / 2;
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(spin, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(spread, {
            toValue: 0,
            duration: half,
            easing: ease,
            useNativeDriver: true,
          }),
          Animated.timing(spread, {
            toValue: 1,
            duration: half,
            easing: ease,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [spin, spread, duration, reduced]);

  const dot = size * 0.3;
  const minOffset = dot / 2;
  const maxOffset = size * 0.33;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const offset = spread.interpolate({ inputRange: [0, 1], outputRange: [minOffset, maxOffset] });
  const opposite = Animated.multiply(offset, -1);
  const scale = spread.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });
  // White ball on dark screens, ink ball on light ones; the red one is the brand red.
  const second = scheme === 'dark' ? colors.onScrim : colors.text;
  const base = {
    width: dot,
    height: dot,
    borderRadius: dot / 2,
    left: (size - dot) / 2,
    top: (size - dot) / 2,
  };

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : t('common.loading')}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Animated.View
          style={[
            styles.dot,
            base,
            { backgroundColor: second, transform: [{ translateX: opposite }, { scale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            base,
            { backgroundColor: colors.brand, transform: [{ translateX: offset }, { scale }] },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/** Full-screen loading: app start, a page loading. */
export function BolingoFullScreenLoader({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.full, { backgroundColor: colors.background }]}>
      <BolingoLoader size={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute' },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
