import { StationType } from './transitNetworkTypes';

/**
 * Durak tipi atamaları — coğrafi / işlevsel sınıflandırma.
 * ML ve karar destek katmanları için metadata.
 */
export type StationTypeOverride = {
  stationGroupId: string;
  stationTypes: readonly StationType[];
  notes?: string;
};

export const STATION_TYPE_OVERRIDES: readonly StationTypeOverride[] = [
  {
    stationGroupId: '1006048',
    stationTypes: [StationType.UNIVERSITY],
    notes: 'Erciyes Üniversitesi',
  },
  {
    stationGroupId: '1006071',
    stationTypes: [StationType.UNIVERSITY],
    notes: 'Kayseri Üniversitesi Şehit İsmet Eraslan',
  },
  {
    stationGroupId: '1006049',
    stationTypes: [StationType.HOSPITAL, StationType.UNIVERSITY],
    notes: 'Erciyes Üniversitesi Hastaneleri',
  },
  {
    stationGroupId: '1006061',
    stationTypes: [StationType.HOSPITAL],
    notes: 'Şehir Hastanesi',
  },
  {
    stationGroupId: '1006060',
    stationTypes: [StationType.HOSPITAL],
    notes: 'Psikiyatri Hastanesi',
  },
  {
    stationGroupId: '1006019',
    stationTypes: [StationType.CENTER, StationType.TRANSFER],
    notes: 'Cumhuriyet Meydanı — merkez',
  },
  {
    stationGroupId: '1006001',
    stationTypes: [StationType.INDUSTRIAL, StationType.TERMINAL],
    notes: 'Organize Sanayi — hat başı',
  },
  {
    stationGroupId: '1006017',
    stationTypes: [StationType.INDUSTRIAL],
    notes: 'Eski Sanayi',
  },
  {
    stationGroupId: '1006013',
    stationTypes: [StationType.INDUSTRIAL],
    notes: 'DSI-Yeni Sanayi',
  },
  {
    stationGroupId: '1006009',
    stationTypes: [StationType.STADIUM],
    notes: 'Stadyum',
  },
  {
    stationGroupId: '1006066',
    stationTypes: [StationType.MALL],
    notes: 'Kumsmall AVM',
  },
  {
    stationGroupId: '1006028',
    stationTypes: [StationType.TERMINAL, StationType.TRANSFER],
    notes: 'Doğu Terminali',
  },
  {
    stationGroupId: '1006057',
    stationTypes: [StationType.TERMINAL, StationType.TRANSFER],
    notes: 'Otogar',
  },
  {
    stationGroupId: '1006025',
    stationTypes: [StationType.RESIDENTIAL],
    notes: 'Erciyes Evler',
  },
  {
    stationGroupId: '1006039',
    stationTypes: [StationType.RESIDENTIAL],
    notes: 'İldem bölgesi giriş',
  },
] as const;

const overrideByStationGroupId = new Map(
  STATION_TYPE_OVERRIDES.map((o) => [o.stationGroupId, o] as const)
);

export function getStationTypeOverride(stationGroupId: string): StationTypeOverride | undefined {
  return overrideByStationGroupId.get(stationGroupId);
}

/** Override yoksa OTHER döner. */
export function resolveStationTypes(stationGroupId: string): StationType[] {
  const hit = overrideByStationGroupId.get(stationGroupId);
  if (hit?.stationTypes.length) {
    return [...hit.stationTypes];
  }
  return [StationType.OTHER];
}
