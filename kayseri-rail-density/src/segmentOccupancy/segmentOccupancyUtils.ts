import type { DirectionSplitConfidence } from '../directionSplit/directionSplitTypes';
import type { DirectionPlatformSplit, DirectionSplitResult } from '../directionSplit/directionSplitTypes';
import type { StationDirection } from '../transitNetwork/transitNetworkTypes';
import { getStationGroupById } from '../transitNetwork/transitNetworkUtils';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type {
  OccupancyRiskLevel,
  PlatformBoardingEstimate,
  SegmentOccupancyConfidence,
} from './segmentOccupancyTypes';

const CONFIDENCE_RANK: Record<SegmentOccupancyConfidence, number> = {
  low: 0,
  medium: 1,
  'medium-high': 2,
  high: 3,
};

export function calculateOccupancyRate(onboard: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, onboard / capacity);
}

export function getRiskLevel(occupancyRate: number): OccupancyRiskLevel {
  if (occupancyRate > 1) return 'OVER_CAPACITY';
  if (occupancyRate >= 0.8) return 'HIGH';
  if (occupancyRate >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export function createSegmentId(fromPlatformId: string, toPlatformId: string): string {
  return `${fromPlatformId}>>${toPlatformId}`;
}

export function clampAlightingRate(rate: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, rate));
}

export function getPlatformBoardingMap(
  boardings: readonly PlatformBoardingEstimate[]
): ReadonlyMap<string, PlatformBoardingEstimate> {
  return new Map(boardings.map((b) => [b.platformId, b] as const));
}

export function resolveBoardingForPlatform(
  platformId: string,
  boardingMap: ReadonlyMap<string, PlatformBoardingEstimate>,
  network: TransitNetwork
): PlatformBoardingEstimate {
  const hit = boardingMap.get(platformId);
  if (hit) return hit;

  const platform = network.platformsById[platformId];
  const group = platform
    ? getStationGroupById(platform.stationGroupId, network)
    : undefined;

  return {
    platformId,
    stationGroupId: platform?.stationGroupId ?? '',
    stationName: platform?.stationName ?? 'Unknown',
    passengerCount: 0,
    confidence: 'low',
    stationTypes: group?.stationTypes ?? [],
    isTransferStation: group?.isTransferStation ?? false,
  };
}

const CONFIDENCE_ORDER: SegmentOccupancyConfidence[] = ['low', 'medium', 'medium-high', 'high'];

export function minConfidence(
  a: SegmentOccupancyConfidence,
  b: SegmentOccupancyConfidence
): SegmentOccupancyConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

export function getConfidenceFromInputs(
  confidences: readonly SegmentOccupancyConfidence[],
  smoothingFactor: number
): SegmentOccupancyConfidence {
  if (!confidences.length) return 'low';

  const avgRank =
    confidences.reduce((sum, c) => sum + CONFIDENCE_RANK[c], 0) / confidences.length;
  const smoothed = avgRank * (1 - smoothingFactor) + CONFIDENCE_RANK.low * smoothingFactor;
  const idx = Math.round(Math.min(CONFIDENCE_ORDER.length - 1, Math.max(0, smoothed)));
  return CONFIDENCE_ORDER[idx]!;
}

export function directionSplitToPlatformBoardings(
  result: DirectionSplitResult,
  network: TransitNetwork
): PlatformBoardingEstimate[] {
  return result.splits.map((split) => splitToPlatformBoardingWithResult(split, result, network));
}

export function directionSplitToPlatformBoardingsForDirection(
  results: readonly DirectionSplitResult[],
  direction: StationDirection,
  network: TransitNetwork
): PlatformBoardingEstimate[] {
  const out: PlatformBoardingEstimate[] = [];
  for (const result of results) {
    for (const split of result.splits) {
      if (split.direction !== direction) continue;
      out.push(splitToPlatformBoardingWithResult(split, result, network));
    }
  }
  return out;
}

function splitToPlatformBoardingWithResult(
  split: DirectionPlatformSplit,
  result: DirectionSplitResult,
  network: TransitNetwork
): PlatformBoardingEstimate {
  const platform = network.platformsById[split.platformId];
  const group = platform
    ? getStationGroupById(platform.stationGroupId, network)
    : undefined;

  return {
    platformId: split.platformId,
    stationGroupId: platform?.stationGroupId ?? result.stationGroupId,
    stationName: platform?.stationName ?? result.stationName,
    passengerCount: split.passengerCount,
    confidence: split.confidence,
    stationTypes: group?.stationTypes ?? [],
    isTransferStation: group?.isTransferStation ?? false,
  };
}

export function isMorningPeakHour(hour: number, morningPeakHours: readonly number[]): boolean {
  return morningPeakHours.includes(hour);
}

export function isEveningPeakHour(hour: number, eveningPeakHours: readonly number[]): boolean {
  return eveningPeakHours.includes(hour);
}

export function hasStationTypeInBoarding(
  boarding: PlatformBoardingEstimate,
  ...types: import('../transitNetwork/transitNetworkTypes').StationType[]
): boolean {
  return types.some((t) => boarding.stationTypes.includes(t));
}
