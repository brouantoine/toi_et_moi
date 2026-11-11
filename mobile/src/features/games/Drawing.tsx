/**
 * Finger drawing on a square canvas stored as strokes on a 1000 x 1000 grid, so a
 * drawing made on one phone looks the same on the other, whatever their sizes.
 */
import * as Haptics from 'expo-haptics';
import { Eraser, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { IconButton, inks, PressableScale, useTheme } from '@/ui';

import type { Stroke } from './useGames';

const GRID = 1000;
const MIN_STEP = 6; // grid units between two kept points
const MAX_POINTS = 7800;
export const WIDTHS = [8, 18] as const;

function pathOf(points: number[], scale: number): string {
  if (points.length < 2) return '';
  const at = (i: number) => (points[i] ?? 0) * scale;
  let d = `M${at(0)} ${at(1)}`;
  if (points.length === 2) d += ' l0.1 0.1'; // a dot
  for (let i = 2; i < points.length; i += 2) d += ` L${at(i)} ${at(i + 1)}`;
  return d;
}

/** Read-only drawing, any size. */
export function DrawingView({
  strokes,
  size,
  testID,
}: {
  strokes: Stroke[];
  size: number;
  testID?: string;
}) {
  const { colors, radii } = useTheme();
  const scale = size / GRID;
  return (
    <View
      testID={testID}
      style={[
        styles.paper,
        {
          width: size,
          height: size,
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Svg width={size} height={size}>
        {strokes.map((stroke, index) => (
          <Path
            key={index}
            d={pathOf(stroke.p, scale)}
            stroke={inks[stroke.c] ?? inks[0]}
            strokeWidth={stroke.w * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

type CanvasProps = { strokes: Stroke[]; onChange: (strokes: Stroke[]) => void };

/** Drawing surface with a palette, two pen sizes, undo and clear. */
export function DrawingCanvas({ strokes, onChange }: CanvasProps) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const [size, setSize] = useState(0);
  const [ink, setInk] = useState(0);
  const [width, setWidth] = useState<number>(WIDTHS[0]);
  const [live, setLive] = useState<number[] | null>(null);
  const point = (event: GestureResponderEvent): [number, number] => {
    const s = size || 1;
    const clamp = (v: number) => Math.max(0, Math.min(GRID, Math.round((v / s) * GRID)));
    return [clamp(event.nativeEvent.locationX), clamp(event.nativeEvent.locationY)];
  };
  const used = strokes.reduce((sum, stroke) => sum + stroke.p.length / 2, 0);

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => setLive(point(event)),
    onResponderMove: (event: GestureResponderEvent) => {
      if (!live || used + live.length / 2 >= MAX_POINTS) return;
      const [x, y] = point(event);
      const lx = live[live.length - 2] ?? x;
      const ly = live[live.length - 1] ?? y;
      if (Math.hypot(x - lx, y - ly) < MIN_STEP) return;
      setLive([...live, x, y]);
    },
    onResponderRelease: () => {
      if (live && live.length >= 2) onChange([...strokes, { c: ink, w: width, p: live }]);
      setLive(null);
    },
  };

  const onLayout = (event: LayoutChangeEvent) => setSize(event.nativeEvent.layout.width);
  const scale = size / GRID;

  return (
    <View style={{ gap: spacing.smd }}>
      <View
        testID="drawing-canvas"
        onLayout={onLayout}
        {...responder}
        style={[
          styles.canvas,
          { borderRadius: radii.xl, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {size ? (
          <Svg width={size} height={size}>
            {strokes.map((stroke, index) => (
              <Path
                key={index}
                d={pathOf(stroke.p, scale)}
                stroke={inks[stroke.c]}
                strokeWidth={stroke.w * scale}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {live ? (
              <Path
                d={pathOf(live, scale)}
                stroke={inks[ink]}
                strokeWidth={width * scale}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={[styles.row, styles.flex, styles.wrap, { gap: spacing.xs }]}>
          {inks.map((colour, index) => (
            <PressableScale
              key={colour}
              testID={`ink-${index}`}
              accessibilityRole="button"
              accessibilityLabel={t('games.draw.ink', { n: index + 1 })}
              accessibilityState={{ selected: ink === index }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                setInk(index);
              }}
              style={[styles.swatch, { borderColor: ink === index ? colors.text : colors.surface }]}
            >
              <View style={[styles.dot, { backgroundColor: colour }]} />
            </PressableScale>
          ))}
        </View>
        <PressableScale
          testID="pen-size"
          accessibilityRole="button"
          accessibilityLabel={t(width === WIDTHS[0] ? 'games.draw.thick' : 'games.draw.thin')}
          onPress={() => setWidth(width === WIDTHS[0] ? WIDTHS[1] : WIDTHS[0])}
          style={[styles.pen, { backgroundColor: colors.surfaceMuted }]}
        >
          <View
            style={{
              width: width === WIDTHS[0] ? 8 : 16,
              height: width === WIDTHS[0] ? 8 : 16,
              borderRadius: 8,
              backgroundColor: inks[ink],
            }}
          />
        </PressableScale>
        <IconButton
          testID="drawing-undo"
          icon={Undo2}
          label={t('games.draw.undo')}
          onPress={() => onChange(strokes.slice(0, -1))}
        />
        <IconButton
          testID="drawing-clear"
          icon={Eraser}
          label={t('games.draw.clear')}
          onPress={() => onChange([])}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
  paper: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 24, height: 24, borderRadius: 12 },
  pen: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
