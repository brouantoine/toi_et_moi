/**
 * Gentle motion primitives (React Native Animated, native driver). Every one of them
 * renders still content when the person asked the system to reduce motion.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion, useTheme } from './theme';

/** Content that arrives softly: fades in while rising a few points. */
export function FadeIn({
  children,
  delay = 0,
  style,
  testID,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const { motion } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.base + 120,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay, motion.base]);
  if (reduced)
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View
      testID={testID}
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** A small bounce to acknowledge a gesture (e.g. a heart given). */
export function usePop(): {
  style: { transform: { scale: Animated.AnimatedInterpolation<number> }[] };
  pop: () => void;
} {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  const pop = () => {
    if (reduced) return;
    value.setValue(0);
    Animated.spring(value, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start(
      () => value.setValue(0),
    );
  };
  const scale = value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.28, 1] });
  return { style: { transform: [{ scale }] }, pop };
}

const PARTICLES = 14;

/**
 * A short burst of soft confetti in the app's colours, played once each time `play`
 * changes to a new truthy value. Purely decorative: hidden from screen readers.
 */
export function Celebration({ play, testID }: { play: number | string | false; testID?: string }) {
  const reduced = useReducedMotion();
  const { colors, hues } = useTheme();
  const palette = [colors.primary, hues.amber.fg, hues.sage.fg, colors.primarySoft, hues.lagoon.fg];
  const [progress] = useState(() => new Animated.Value(0));
  // Visible while the burst for the current `play` value has not finished yet.
  const [finished, setFinished] = useState<number | string | false>(false);
  const visible = Boolean(play) && play !== finished && !reduced;

  useEffect(() => {
    if (!play || reduced) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(() => setFinished(play));
    return () => animation.stop();
  }, [play, reduced, progress]);

  if (!visible) return null;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const distance = 70 + (i % 3) * 22;
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(angle) * distance],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(angle) * distance - 20],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const size = 6 + (i % 3) * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: size,
                height: size,
                borderRadius: i % 2 ? size / 2 : 2,
                backgroundColor: palette[i % palette.length],
                opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: '50%', top: '50%' },
});
