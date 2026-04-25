import stationsJson from '../../assets/data/stations.json';
import type { PassengerRow, StationRecord } from '../types';
import { KAYSERI_REGION } from '../constants/theme';

const BASE_LAT = KAYSERI_REGION.latitude;
const BASE_LON = KAYSERI_REGION.longitude;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function approximateCoord(durakId: string, index: number): Pick<StationRecord, 'latitude' | 'longitude'> {
  const h = hashString(durakId);
  const angle = ((h % 360) * Math.PI) / 180;
  const ring = 0.0022 + (index % 7) * 0.00055;
  return {
    latitude: BASE_LAT + ring * Math.cos(angle),
    longitude: BASE_LON + ring * Math.sin(angle),
  };
}

/** OSM sonuçları + passenger verisinde olup koordinatsız kalan duraklar için yaklaşık konum. */
export function buildMergedStations(passengerRows: PassengerRow[]): StationRecord[] {
  const fromFile = (stationsJson as StationRecord[]).map((s) => ({
    ...s,
    durakId: String(s.durakId),
    approximate: false,
  }));
  const byId = new Map<string, StationRecord>();
  for (const s of fromFile) {
    byId.set(s.durakId, s);
  }

  const uniqueIds: { durakId: string; durakAd: string }[] = [];
  const seen = new Set<string>();
  for (const r of passengerRows) {
    if (seen.has(r.durakId)) continue;
    seen.add(r.durakId);
    uniqueIds.push({ durakId: r.durakId, durakAd: r.durakAd });
  }

  uniqueIds.sort((a, b) => a.durakId.localeCompare(b.durakId));

  let missIdx = 0;
  for (const u of uniqueIds) {
    if (byId.has(u.durakId)) continue;
    const coord = approximateCoord(u.durakId, missIdx);
    missIdx += 1;
    byId.set(u.durakId, {
      durakId: u.durakId,
      durakAd: u.durakAd,
      ...coord,
      approximate: true,
    });
  }

  return [...byId.values()].sort((a, b) => a.durakAd.localeCompare(b.durakAd, 'tr'));
}
