import { useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReducedMotion, useTheme } from './theme';

const DISABLED_OPACITY = 0.45;

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Style of the visible (animated) surface. */
  style?: StyleProp<ViewStyle>;
  /** Scale reached while pressed. Defaults to the motion token. */
  scaleTo?: number;
};

/**
 * Tappable surface with a soft press-in: a slight sink on the native driver,
 * or a plain dim when the user asked to reduce motion. Every tappable surface
 * in the app goes through this, so feedback feels the same everywhere.
 */
export function PressableScale({
  children,
  style,
  scaleTo,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  const animate = (to: number) => {
    Animated.timing(progress, {
      toValue: to,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  };

  const transform = reduced
    ? undefined
    : [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, scaleTo ?? motion.pressScale],
          }),
        },
      ];
  const opacity = disabled
    ? DISABLED_OPACITY
    : progress.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 0.7 : 0.94] });

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        animate(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(0);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { opacity, transform }]}>{children}</Animated.View>
    </Pressable>
  );
}
