export type Point = { latitude: number; longitude: number };

/** Region showing both points with some margin (or one point, zoomed on its city). */
export function regionFor(points: Point[]) {
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.08),
    longitudeDelta: Math.max((maxLon - minLon) * 1.6, 0.08),
  };
}
