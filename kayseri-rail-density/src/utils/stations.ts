import stationsJson from '../../assets/data/stations.json';
import type { DisplayPassengerRow, PassengerRow, StationRecord } from '../types';
import { DURAK_ID_CANONICAL_AD, getCanonicalDurakAd } from '../constants/durakCanonicalMap';
import { KAYSERI_REGION } from '../constants/theme';

const BASE_LAT = KAYSERI_REGION.latitude;
const BASE_LON = KAYSERI_REGION.longitude;

/** assets/data/stations.json — id + canonical isim; lat/lng isteğe bağlı. */
type StationsFileRow = {
  durakId: string | number;
  name?: string;
  durakAd?: string;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

const CANONICAL_ID_LIST = (Object.keys(DURAK_ID_CANONICAL_AD) as string[]).sort(
  (a, b) => Number(a) - Number(b)
);

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

function normalizeFileCoords(raw: StationsFileRow): { durakId: string; lat: number | null; lng: number | null } {
  const durakId = String(raw.durakId);
  let lat: number | null = null;
  let lng: number | null = null;
  if (raw.lat != null) lat = raw.lat;
  else if (raw.latitude != null) lat = raw.latitude;
  if (raw.lng != null) lng = raw.lng;
  else if (raw.longitude != null) lng = raw.longitude;
  return { durakId, lat, lng };
}

/**
 * DURAK_ID_CANONICAL_AD + stations.json (durakId + koordinat) + passenger yedek.
 * Eşleştirme sadece durakId üzerinden; isim her zaman kanonik map’ten.
 */
export function buildMergedStations(
  passengerRows: ReadonlyArray<PassengerRow | DisplayPassengerRow>
): StationRecord[] {
  const rawList = stationsJson as StationsFileRow[];
  const seenId = new Set<string>();

  for (const raw of rawList) {
    const id = String(raw.durakId);
    if (seenId.has(id)) {
      throw new Error(`[stations] Duplicate durakId in stations.json: ${id}`);
    }
    seenId.add(id);
    const n = Number(id);
    if (!Number.isInteger(n) || DURAK_ID_CANONICAL_AD[n] === undefined) {
      console.error(`[stations] stations.json contains durakId not in DURAK_ID_CANONICAL_AD: ${id}`);
      throw new Error(`Invalid durakId in stations.json: ${id}`);
    }
  }

  const stationMapById: Record<string, { lat: number | null; lng: number | null }> = Object.fromEntries(
    rawList.map((r) => {
      const n = normalizeFileCoords(r);
      return [n.durakId, { lat: n.lat, lng: n.lng }];
    })
  );

  if (rawList.length === 0) {
    console.warn('[stations] stations.json is empty; using approximate positions for all canonical duraklar.');
  } else {
    for (const idStr of CANONICAL_ID_LIST) {
      if (stationMapById[idStr] === undefined) {
        console.warn(
          `[stations] DURAK_ID_CANONICAL_AD entry missing from stations.json: ${idStr} (${DURAK_ID_CANONICAL_AD[Number(idStr)]})`
        );
      }
    }
  }

  const byId = new Map<string, StationRecord>();
  let approxIdx = 0;

  for (const idStr of CANONICAL_ID_LIST) {
    const n = Number(idStr);
    const durakAd = DURAK_ID_CANONICAL_AD[n]!;
    const fromFile = stationMapById[idStr];
    let latitude: number;
    let longitude: number;
    let approximate: boolean;

    if (!fromFile) {
      const c = approximateCoord(idStr, approxIdx);
      approxIdx += 1;
      latitude = c.latitude;
      longitude = c.longitude;
      approximate = true;
    } else if (fromFile.lat == null || fromFile.lng == null) {
      console.warn(
        `[stations] No coordinates in stations.json for durakId ${idStr} (${durakAd}); using approximate position`
      );
      const c = approximateCoord(idStr, approxIdx);
      approxIdx += 1;
      latitude = c.latitude;
      longitude = c.longitude;
      approximate = true;
    } else {
      latitude = fromFile.lat;
      longitude = fromFile.lng;
      approximate = false;
    }
    byId.set(idStr, { durakId: idStr, durakAd, latitude, longitude, approximate });
  }

  const seenPass = new Set<string>();
  for (const r of passengerRows) {
    if (seenPass.has(r.durakId)) continue;
    seenPass.add(r.durakId);
    if (byId.has(r.durakId)) continue;
    console.error(
      `[stations] yolcu verisinde, DURAK / birleşik dura listesinde olmayan durakId: ${r.durakId}`
    );
    const c = approximateCoord(r.durakId, approxIdx);
    approxIdx += 1;
    byId.set(r.durakId, {
      durakId: r.durakId,
      durakAd: getCanonicalDurakAd(r.durakId, r.durakAd),
      ...c,
      approximate: true,
    });
  }

  return [...byId.values()].sort((a, b) => a.durakAd.localeCompare(b.durakAd, 'tr'));
}
