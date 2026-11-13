import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { useTheme } from '@/ui';

import { regionFor, type Point } from './region';

export type DistanceMapProps = {
  mine: Point | null | undefined;
  theirs: Point | null | undefined;
  partnerName: string;
  /** "5 minutes ago": when the partner's position was last shared. */
  partnerSeen?: string;
};

/** Android draws the map with Google Maps, which needs an API key (else it crashes). */
export function mapAvailable(): boolean {
  if (Platform.OS !== 'android') return true;
  return Boolean(Constants.expoConfig?.extra?.hasAndroidMapsKey);
}

/** Both positions on the system map, linked by a dashed line. */
export function DistanceMap({ mine, theirs, partnerName, partnerSeen }: DistanceMapProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const points = [mine, theirs].filter((p): p is Point => Boolean(p));
  if (!points.length || !mapAvailable()) return null;
  // A new position re-frames the map (initialRegion is only read once).
  const frame = points.map((p) => `${p.latitude},${p.longitude}`).join(';');
  return (
    <MapView
      key={frame}
      style={StyleSheet.absoluteFill}
      initialRegion={regionFor(points)}
      userInterfaceStyle={scheme}
    >
      {mine ? (
        <Marker coordinate={mine} title={t('distance.you')} pinColor={colors.secondary} />
      ) : null}
      {theirs ? (
        <Marker
          testID="distance-partner-marker"
          coordinate={theirs}
          title={partnerName}
          description={partnerSeen}
          pinColor={colors.primary}
        />
      ) : null}
      {mine && theirs ? (
        <Polyline
          coordinates={[mine, theirs]}
          strokeColor={colors.primary}
          strokeWidth={3}
          lineDashPattern={[8, 8]}
          geodesic
        />
      ) : null}
    </MapView>
  );
}
