import type { StationDirection, StationPlatform, TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import { DEFAULT_TRANSIT_DIRECTION_CONFIG } from '../transitNetwork/transitNetworkTypes';
import type {
  DayType,
  DirectionSplitConfidence,
  DirectionSplitConfig,
  DirectionSplitInput,
  DirectionSplitReason,
} from './directionSplitTypes';
import { StationType } from '../transitNetwork/transitNetworkTypes';

export function getDayTypeFromDate(date: string): DayType {
  const parsed = parseYmd(date);
  if (!parsed) return 'weekday';
  const day = parsed.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

export function isWeekendFromDate(date: string): boolean {
  return getDayTypeFromDate(date) === 'weekend';
}

function parseYmd(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function isMorningPeak(hour: number, config: DirectionSplitConfig): boolean {
  return config.morningPeakHours.includes(hour);
}

export function isEveningPeak(hour: number, config: DirectionSplitConfig): boolean {
  return config.eveningPeakHours.includes(hour);
}

export type RatioMap = Record<StationDirection, number>;

/** Oranları [minRatio, maxRatio] içinde tutup toplamı 1 yapar. */
export function normalizeRatios(
  ratios: RatioMap,
  config: DirectionSplitConfig
): RatioMap {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  let a = Math.max(config.minRatio, ratios[directionA] ?? 0);
  let b = Math.max(config.minRatio, ratios[directionB] ?? 0);
  a = Math.min(config.maxRatio, a);
  b = Math.min(config.maxRatio, b);
  const sum = a + b;
  if (sum <= 0) {
    return { [directionA]: 0.5, [directionB]: 0.5 };
  }
  return { [directionA]: a / sum, [directionB]: b / sum };
}

/**
 * Toplam yolcuyu oranlara göre tam sayıya böler (largest remainder).
 * passengerCount toplamı totalPassengerCount ile eşleşir.
 */
export function allocatePassengerCounts(
  totalPassengerCount: number,
  ratios: RatioMap
): RatioMap {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const total = Math.max(0, Math.round(totalPassengerCount));
  if (total === 0) {
    return { [directionA]: 0, [directionB]: 0 };
  }

  const rawA = total * (ratios[directionA] ?? 0.5);
  const floorA = Math.floor(rawA);
  const floorB = Math.floor(total * (ratios[directionB] ?? 0.5));
  let countA = floorA;
  let countB = floorB;
  let remainder = total - countA - countB;

  const fractions: { direction: StationDirection; frac: number }[] = [
    { direction: directionA, frac: rawA - floorA },
    { direction: directionB, frac: total * (ratios[directionB] ?? 0.5) - floorB },
  ];
  fractions.sort((x, y) => y.frac - x.frac);

  let i = 0;
  while (remainder > 0) {
    const dir = fractions[i % fractions.length]!.direction;
    if (dir === directionA) countA += 1;
    else countB += 1;
    remainder -= 1;
    i += 1;
  }

  return { [directionA]: countA, [directionB]: countB };
}

export function getStationSequenceIndex(
  stationGroupId: string,
  network: TransitNetwork
): number | null {
  const group = network.stationGroupsById[stationGroupId];
  if (!group?.platforms.length) return null;
  const { directionA } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const platformA = group.platforms.find((p) => p.direction === directionA);
  return platformA?.sequenceIndex ?? null;
}

/** Merkeze giden yön (directionA = artan sequence). */
export function getTowardCenterDirection(
  stationGroupId: string,
  network: TransitNetwork,
  config: DirectionSplitConfig
): StationDirection | null {
  const seq = getStationSequenceIndex(stationGroupId, network);
  const centerSeq = getStationSequenceIndex(config.centerStationGroupId, network);
  if (seq == null || centerSeq == null) return null;
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  if (seq < centerSeq) return directionA;
  if (seq > centerSeq) return directionB;
  return null;
}

/** Merkezden uzaklaşan yön. */
export function getAwayFromCenterDirection(
  stationGroupId: string,
  network: TransitNetwork,
  config: DirectionSplitConfig
): StationDirection | null {
  const toward = getTowardCenterDirection(stationGroupId, network, config);
  if (!toward) return null;
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  return toward === directionA ? directionB : directionA;
}

export function getTowardUniversityDirection(
  stationGroupId: string,
  network: TransitNetwork,
  config: DirectionSplitConfig
): StationDirection | null {
  const seq = getStationSequenceIndex(stationGroupId, network);
  const uniSeq = getStationSequenceIndex(config.universityAnchorStationGroupId, network);
  if (seq == null || uniSeq == null) return null;
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  if (seq <= uniSeq) return directionA;
  return directionB;
}

/** Hat başı (sanayi bölgesi) yönü — sequence azalan = directionB. */
export function getTowardIndustrialDirection(
  stationGroupId: string,
  network: TransitNetwork
): StationDirection | null {
  const seq = getStationSequenceIndex(stationGroupId, network);
  if (seq == null) return null;
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  if (seq === 0) return directionB;
  return directionB;
}

export function applyBoost(
  ratios: RatioMap,
  targetDirection: StationDirection,
  boost: number,
  config: DirectionSplitConfig
): RatioMap {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const other = targetDirection === directionA ? directionB : directionA;
  const next: RatioMap = { ...ratios };
  next[targetDirection] = (next[targetDirection] ?? 0.5) + boost;
  next[other] = (next[other] ?? 0.5) - boost * 0.85;
  return normalizeRatios(next, config);
}

export function applyDampening(factor: number, isWeekend: boolean, config: DirectionSplitConfig): number {
  return isWeekend ? factor * config.weekendBoostFactor : factor;
}

export function hasStationType(
  types: readonly StationType[],
  ...wanted: StationType[]
): boolean {
  return wanted.some((t) => types.includes(t));
}

export function getTerminalDominantDirection(
  platforms: readonly StationPlatform[]
): { direction: StationDirection; isTerminal: boolean } {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const platA = platforms.find((p) => p.direction === directionA);
  const platB = platforms.find((p) => p.direction === directionB);
  if (platA?.isTerminal && !platB?.isTerminal) {
    return { direction: directionA, isTerminal: true };
  }
  if (platB?.isTerminal && !platA?.isTerminal) {
    return { direction: directionB, isTerminal: true };
  }
  if (platA?.isTerminal && platB?.isTerminal) {
    return { direction: directionA, isTerminal: true };
  }
  return { direction: directionA, isTerminal: false };
}

export function getSplitConfidence(params: {
  input: DirectionSplitInput;
  reasons: readonly DirectionSplitReason[];
  isTerminalBias: boolean;
  config: DirectionSplitConfig;
}): DirectionSplitConfidence {
  const { input, reasons, isTerminalBias, config } = params;

  if (input.isTransferStation) {
    const hasPeak =
      isMorningPeak(input.hour, config) || isEveningPeak(input.hour, config);
    return hasPeak ? 'medium' : 'low';
  }

  if (isTerminalBias) {
    return 'medium';
  }

  const hasStrongSignal =
    reasons.includes('MORNING_PEAK_TOWARD_CENTER') ||
    reasons.includes('EVENING_PEAK_AWAY_FROM_CENTER') ||
    reasons.includes('UNIVERSITY_MORNING_TOWARD_CAMPUS') ||
    reasons.includes('UNIVERSITY_EVENING_TOWARD_CITY') ||
    reasons.includes('INDUSTRIAL_MORNING_TOWARD_INDUSTRIAL') ||
    reasons.includes('INDUSTRIAL_EVENING_TOWARD_CITY');

  const typed =
    hasStationType(input.stationTypes, StationType.UNIVERSITY, StationType.INDUSTRIAL, StationType.CENTER) &&
    hasStrongSignal;

  if (typed && !input.isWeekend && (isMorningPeak(input.hour, config) || isEveningPeak(input.hour, config))) {
    return 'medium-high';
  }

  if (hasStrongSignal) {
    return 'medium';
  }

  return 'medium';
}

export function sortPlatformsByDirection(
  platforms: readonly StationPlatform[]
): StationPlatform[] {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  return [...platforms].sort((a, b) => {
    if (a.direction === directionA) return -1;
    if (b.direction === directionA) return 1;
    if (a.direction === directionB) return -1;
    if (b.direction === directionB) return 1;
    return a.direction.localeCompare(b.direction);
  });
}
