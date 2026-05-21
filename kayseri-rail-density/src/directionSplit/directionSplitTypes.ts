import type { StationDirection, StationType } from '../transitNetwork/transitNetworkTypes';

/** Gün sınıfı — tarihten türetilir. */
export type DayType = 'weekday' | 'weekend';

export type DirectionSplitConfidence = 'low' | 'medium' | 'medium-high' | 'high';

/** Uygulanan kural / gerekçe etiketi. */
export type DirectionSplitReason =
  | 'BASE_EQUAL_SPLIT'
  | 'MORNING_PEAK_TOWARD_CENTER'
  | 'EVENING_PEAK_AWAY_FROM_CENTER'
  | 'WEEKEND_DAMPENING'
  | 'UNIVERSITY_MORNING_TOWARD_CAMPUS'
  | 'UNIVERSITY_EVENING_TOWARD_CITY'
  | 'INDUSTRIAL_MORNING_TOWARD_INDUSTRIAL'
  | 'INDUSTRIAL_EVENING_TOWARD_CITY'
  | 'TRANSFER_STATION_UNCERTAINTY'
  | 'TERMINAL_SINGLE_DIRECTION_BIAS'
  | 'CENTER_STATION_BALANCED';

export type DirectionSplitRatio = {
  direction: StationDirection;
  ratio: number;
};

export type DirectionSplitInput = {
  stationGroupId: string;
  stationName: string;
  totalPassengerCount: number;
  date: string;
  hour: number;
  dayType: DayType;
  isWeekend: boolean;
  stationTypes: readonly StationType[];
  isTransferStation: boolean;
};

export type DirectionPlatformSplit = {
  platformId: string;
  direction: StationDirection;
  ratio: number;
  passengerCount: number;
  confidence: DirectionSplitConfidence;
  reasons: readonly DirectionSplitReason[];
};

export type DirectionSplitResult = {
  stationGroupId: string;
  stationName: string;
  totalPassengerCount: number;
  splits: readonly DirectionPlatformSplit[];
};

/**
 * Yön semantiği — ileride directionA = Talas, directionB = OSB gibi etiketlenebilir.
 * Şimdilik directionA/B ile eşlenir.
 */
export type DirectionRoleConfig = {
  direction: StationDirection;
  /** İnsan okunur etiket (ör. "Talas yönü"). */
  label: string;
};

export type DirectionSplitConfig = {
  directionRoles: {
    directionA: DirectionRoleConfig;
    directionB: DirectionRoleConfig;
  };
  /** Merkez referans durağı (Cumhuriyet Meydanı). */
  centerStationGroupId: string;
  /** Üniversite kümesi referansı. */
  universityAnchorStationGroupId: string;
  /** Sanayi hattı başı referansı. */
  industrialAnchorStationGroupId: string;
  baseRatio: Readonly<Record<StationDirection, number>>;
  morningPeakHours: readonly number[];
  eveningPeakHours: readonly number[];
  /** Sabah pikte merkeze giden yöne eklenen oran (0–1 ölçeğinde delta). */
  morningCenterBoost: number;
  /** Akşam pikte merkezden çıkan yöne eklenen oran delta. */
  eveningCenterBoost: number;
  /** Hafta sonu boost çarpanı (0 = etkisiz, 1 = tam). */
  weekendBoostFactor: number;
  universityMorningBoost: number;
  universityEveningBoost: number;
  industrialMorningBoost: number;
  industrialEveningBoost: number;
  /** Aktarma duraklarında confidence düşürme (0–1). */
  transferConfidencePenalty: number;
  /** Terminal durakta baskın yön oranı. */
  terminalDominantRatio: number;
  minRatio: number;
  maxRatio: number;
};
