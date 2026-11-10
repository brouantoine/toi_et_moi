import { MapPinned } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/ui';

import type { DistanceMapProps } from './DistanceMap';

/** The native map does not exist in a browser: a quiet placeholder keeps the page whole. */
export function DistanceMap({ theirs, partnerName, partnerSeen }: DistanceMapProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Icon icon={MapPinned} size={40} color="textMuted" />
      {theirs ? (
        <Text muted testID="distance-partner-marker">
          {partnerSeen ? `${partnerName} · ${partnerSeen}` : partnerName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
});
