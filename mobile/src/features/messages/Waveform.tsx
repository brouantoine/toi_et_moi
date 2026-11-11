import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

const BAR = 3;
const GAP = 2;
const MIN_BAR = 3;

type Props = {
  bars: number[];
  /** 0 to 1: bars before it take the played colour. */
  progress?: number;
  played: string;
  idle: string;
  /** Unplayed bars can be a faded ink, readable on any bubble in both schemes. */
  idleOpacity?: number;
  height?: number;
  /** Tapping a bar seeks there (fraction 0-1). */
  onSeek?: (fraction: number) => void;
  testID?: string;
};

/** Snapchat-like bars: rounded, centred, filling with colour as the note plays. */
export function Waveform({
  bars,
  progress = 0,
  played,
  idle,
  idleOpacity = 1,
  height = 30,
  onSeek,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);
  const playedBars = Math.round(progress * bars.length);
  const content = (
    <View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.row, { height, gap: GAP }]}
      importantForAccessibility="no-hide-descendants"
    >
      {bars.map((value, index) => (
        <View
          key={index}
          style={{
            width: BAR,
            borderRadius: BAR / 2,
            height: Math.max(MIN_BAR, Math.round((value / 100) * height)),
            backgroundColor: index < playedBars ? played : idle,
            opacity: index < playedBars ? 1 : idleOpacity,
          }}
        />
      ))}
    </View>
  );
  if (!onSeek) return content;
  return (
    <Pressable
      accessible={false}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={(event) => {
        if (width > 0) onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / width)));
      }}
    >
      {content}
    </Pressable>
  );
}

/** Natural width of a waveform: lets bubbles size themselves to the note. */
export const waveformWidth = (count: number) => count * BAR + Math.max(0, count - 1) * GAP;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
