/** Dünya ortalama yarıçapı (metre) */
const EARTH_R_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * İki WGS84 noktası arasındaki yeryüzü mesafesi (metre).
 */
export function haversineDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_R_M * c;
}
