import {
  Camera,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  Music,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Icon, Ring, useReducedMotion, useTheme, type Hue } from '@/ui';

/** The couple's caricature supplied by the owner (1080x744, on the ink background). */

const COUPLE = require('../../../assets/welcome/couple.png');

const WIDTH = 340;
const HEIGHT = 300;
const IMAGE_HEIGHT = Math.round((WIDTH * 744) / 1080);
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 + 20 };

type Bubble = { icon: LucideIcon; hue: Hue; size: number; x: number; y: number; filled?: boolean };

/** Little moments of a life together, scattered around the couple. */
const BUBBLES: readonly Bubble[] = [
  { icon: Heart, hue: 'red', size: 50, x: 30, y: 96, filled: true },
  { icon: MessageCircle, hue: 'lagoon', size: 44, x: 306, y: 84 },
  { icon: Camera, hue: 'amber', size: 42, x: 170, y: 26 },
  { icon: MapPin, hue: 'sage', size: 38, x: 318, y: 190 },
  { icon: Ring, hue: 'violet', size: 44, x: 22, y: 200 },
  { icon: Music, hue: 'lagoon', size: 34, x: 88, y: 34 },
  { icon: Gift, hue: 'amber', size: 36, x: 252, y: 24 },
];

function FloatingBubble({ bubble, index }: { bubble: Bubble; index: number }) {
  const { hues } = useTheme();
  const reduced = useReducedMotion();
  const [out] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      out.setValue(1);
      return undefined;
    }
    // They burst out from the couple, one after the other, then float gently.
    const scatter = Animated.spring(out, {
      toValue: 1,
      delay: 250 + index * 90,
      useNativeDriver: true,
      speed: 6,
      bounciness: 12,
    });
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2200 + index * 260,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2200 + index * 260,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    scatter.start();
    float.start();
    return () => {
      scatter.stop();
      float.stop();
    };
  }, [reduced, out, drift, index]);

  const hue = hues[bubble.hue];
  const dx = bubble.x - CENTER.x;
  const dy = bubble.y - CENTER.y;
  return (
    <Animated.View
      testID="welcome-bubble"
      style={[
        styles.bubble,
        {
          width: bubble.size,
          height: bubble.size,
          borderRadius: bubble.size / 2,
          left: CENTER.x - bubble.size / 2,
          top: CENTER.y - bubble.size / 2,
          backgroundColor: hue.bg,
          opacity: out.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            {
              translateY: Animated.add(
                out.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }),
                drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
              ),
            },
            { scale: out },
          ],
        },
      ]}
    >
      <Icon
        icon={bubble.icon}
        size={bubble.size * 0.46}
        tint={hue.fg}
        filled={bubble.filled}
        strokeWidth={2}
      />
    </Animated.View>
  );
}

type Props = { accessibilityLabel: string };

export function CoupleIllustration({ accessibilityLabel }: Props) {
  return (
    <View
      testID="welcome-illustration"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.frame}
    >
      <Image source={COUPLE} style={styles.image} contentFit="contain" transition={200} />
      {BUBBLES.map((bubble, index) => (
        <FloatingBubble key={`${bubble.x}-${bubble.y}`} bubble={bubble} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: WIDTH, height: HEIGHT, justifyContent: 'flex-end' },
  image: { width: WIDTH, height: IMAGE_HEIGHT },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
