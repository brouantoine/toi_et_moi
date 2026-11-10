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
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Icon, illustration, Ring, useReducedMotion, useTheme, type Hue } from '@/ui';

const WIDTH = 320;
const HEIGHT = 300;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 + 10 };

type Bubble = { icon: LucideIcon; hue: Hue; size: number; x: number; y: number; filled?: boolean };

/** Little moments of a life together, scattered around the couple. */
const BUBBLES: readonly Bubble[] = [
  { icon: Heart, hue: 'red', size: 54, x: 44, y: 62, filled: true },
  { icon: MessageCircle, hue: 'lagoon', size: 46, x: 268, y: 48 },
  { icon: Camera, hue: 'amber', size: 44, x: 150, y: 30 },
  { icon: MapPin, hue: 'sage', size: 42, x: 292, y: 150 },
  { icon: Ring, hue: 'violet', size: 46, x: 26, y: 168 },
  { icon: Music, hue: 'lagoon', size: 36, x: 84, y: 24 },
  { icon: Gift, hue: 'amber', size: 38, x: 226, y: 26 },
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

/** Original drawing: two people leaning on each other, in the couple's colours. */
function Couple() {
  const { colors } = useTheme();
  const face = {
    stroke: illustration.line,
    strokeWidth: 3,
    strokeLinecap: 'round',
    fill: 'none',
  } as const;
  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 320 300">
      <Circle cx="160" cy="176" r="116" fill={illustration.halo} />
      {/* Her hair, behind */}
      <Path
        d="M160 166c0-32 17-52 42-52s42 20 42 52v66c0 8-6 14-14 14h-56c-8 0-14-6-14-14Z"
        fill={illustration.hair}
      />
      {/* Necks */}
      <Rect x="113" y="186" width="28" height="52" rx="13" fill={illustration.skinA} />
      <Rect x="190" y="192" width="24" height="50" rx="12" fill={illustration.skinB} />
      {/* Shoulders, leaning together */}
      <Path d="M58 300c0-52 28-82 68-82s68 30 68 82Z" fill={colors.primary} />
      <Path d="M140 300c0-47 26-74 62-74s62 27 62 74Z" fill={colors.secondary} />
      {/* Heads */}
      <Circle cx="127" cy="154" r="40" fill={illustration.skinA} />
      <Circle cx="201" cy="166" r="35" fill={illustration.skinB} />
      {/* Hair */}
      <Path
        d="M87 150c0-26 17-43 40-43s40 17 40 43c-9-11-22-17-40-17s-31 6-40 17Z"
        fill={illustration.hair}
      />
      <Path
        d="M166 162c2-21 15-34 35-34s33 13 35 34c-10-9-22-13-35-13s-25 4-35 13Z"
        fill={illustration.hair}
      />
      {/* Happy closed eyes and smiles */}
      <Path d="M110 156q6-6 12 0M134 156q6-6 12 0" {...face} />
      <Path d="M115 172q12 10 24 0" {...face} />
      <Path d="M186 168q5-5 10 0M207 168q5-5 10 0" {...face} />
      <Path d="M191 181q10 8 20 0" {...face} />
      <Circle cx="105" cy="168" r="6" fill={illustration.blush} opacity="0.45" />
      <Circle cx="222" cy="178" r="5.5" fill={illustration.blush} opacity="0.45" />
    </Svg>
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
      <Couple />
      {BUBBLES.map((bubble, index) => (
        <FloatingBubble key={`${bubble.x}-${bubble.y}`} bubble={bubble} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: WIDTH, height: HEIGHT },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
});
