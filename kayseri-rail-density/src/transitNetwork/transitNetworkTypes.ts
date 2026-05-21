/**
 * Kayseri tramvay ağı — station group + direction platform veri modeli.
 * Mevcut durakId (stationGroupId) ile geriye dönük uyumluluk korunur.
 */

export enum StationType {
  CENTER = 'CENTER',
  UNIVERSITY = 'UNIVERSITY',
  HOSPITAL = 'HOSPITAL',
  STADIUM = 'STADIUM',
  MALL = 'MALL',
  INDUSTRIAL = 'INDUSTRIAL',
  RESIDENTIAL = 'RESIDENTIAL',
  TRANSFER = 'TRANSFER',
  TERMINAL = 'TERMINAL',
  OTHER = 'OTHER',
}

/** Yön etiketi — buildTransitNetwork içindeki directionConfig ile atanır. */
export type StationDirection = string;

export type StationPlatform = {
  platformId: string;
  stationGroupId: string;
  stationName: string;
  direction: StationDirection;
  lineId: string;
  oppositePlatformId: string;
  /** Hat üzerindeki sıra (0 = hat başı yönü). */
  sequenceIndex: number;
  isTerminal: boolean;
  lat: number;
  lon: number;
};

export type StationGroup = {
  stationGroupId: string;
  stationName: string;
  canonicalName: string;
  lat: number;
  lon: number;
  isTransferStation: boolean;
  stationTypes: StationType[];
  platforms: StationPlatform[];
};

export type TransitLine = {
  lineId: string;
  lineName: string;
  directions: StationDirection[];
  /** Yön başına, seyahat sırasına göre platformId listesi. */
  platformSequenceByDirection: Record<StationDirection, readonly string[]>;
};

/** İki durak grubu / hat arası aktarma bağlantısı (ileride graf analizi için). */
export type TransferConnection = {
  fromStationGroupId: string;
  toStationGroupId: string;
  connectedLines: readonly string[];
  transferWeight: number;
  possibleDirections: readonly StationDirection[];
  notes?: string;
};

export type TransitNetwork = {
  lines: readonly TransitLine[];
  stationGroups: readonly StationGroup[];
  /** platformId → platform (hızlı erişim). */
  platformsById: Readonly<Record<string, StationPlatform>>;
  /** stationGroupId → station group. */
  stationGroupsById: Readonly<Record<string, StationGroup>>;
  transferConnections: readonly TransferConnection[];
};

/** Varsayılan yön etiketleri — buildTransitNetwork directionConfig ile değiştirilebilir. */
export type TransitDirectionConfig = {
  directionA: StationDirection;
  directionB: StationDirection;
};

export const DEFAULT_TRANSIT_DIRECTION_CONFIG: TransitDirectionConfig = {
  directionA: 'directionA',
  directionB: 'directionB',
};

export const DEFAULT_TRAM_LINE_ID = 'kayseri-tram-t1';
export const DEFAULT_TRAM_LINE_NAME = 'Kayseri Tramvay T1';
