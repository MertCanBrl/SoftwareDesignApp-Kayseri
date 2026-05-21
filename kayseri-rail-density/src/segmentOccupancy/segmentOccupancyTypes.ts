/**
 * Heuristic tahmini tramvay segment doluluk modeli.
 * Gerçek iniş/biniş verisi yoktur; belediye karar destek için "estimated segment occupancy" üretir.
 */

import type { DirectionSplitConfidence } from '../directionSplit/directionSplitTypes';
import type { StationDirection, StationType, TransitNetwork } from '../transitNetwork/transitNetworkTypes';

export type SegmentOccupancyConfidence = DirectionSplitConfidence;

export type OccupancyRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'OVER_CAPACITY';

export type AlightingReason =
  | 'BASE_ALIGHTING_RATE'
  | 'FIRST_STATION_LOW_ALIGHTING'
  | 'LAST_STATION_HIGH_ALIGHTING'
  | 'TERMINAL_ALIGHTING'
  | 'CENTER_STATION_ALIGHTING'
  | 'TRANSFER_STATION_ALIGHTING'
  | 'UNIVERSITY_MORNING_ALIGHTING'
  | 'INDUSTRIAL_MORNING_ALIGHTING'
  | 'EVENING_CENTER_ALIGHTING'
  | 'CAPPED_BY_ONBOARD'
  | 'SMOOTHED_RATE';

export type PlatformBoardingEstimate = {
  platformId: string;
  stationGroupId: string;
  stationName: string;
  passengerCount: number;
  confidence: SegmentOccupancyConfidence;
  stationTypes: readonly StationType[];
  isTransferStation: boolean;
};

export type AlightingEstimate = {
  platformId: string;
  stationGroupId: string;
  estimatedAlightings: number;
  alightingRate: number;
  confidence: SegmentOccupancyConfidence;
  reasons: readonly AlightingReason[];
};

export type SegmentOccupancySegment = {
  segmentId: string;
  fromPlatformId: string;
  toPlatformId: string;
  fromStationName: string;
  toStationName: string;
  direction: StationDirection;
  lineId: string;
  boardingsAtFromStation: number;
  estimatedAlightingsAtFromStation: number;
  /** from durağından çıkış sonrası vagon içi tahmini yolcu (segment doluluk göstergesi). */
  onboardAfterDeparture: number;
  capacity: number;
  occupancyRate: number;
  riskLevel: OccupancyRiskLevel;
  confidence: SegmentOccupancyConfidence;
  reasons: readonly AlightingReason[];
};

export type SegmentOccupancyInput = {
  date: string;
  hour: number;
  direction: StationDirection;
  lineId: string;
  platformBoardings: readonly PlatformBoardingEstimate[];
  network: TransitNetwork;
};

export type SegmentOccupancyResult = {
  date: string;
  hour: number;
  direction: StationDirection;
  lineId: string;
  /** Heuristic tahmin — gerçek ölçüm değildir. */
  isEstimated: true;
  segments: readonly SegmentOccupancySegment[];
  capacity: number;
};

export type SegmentOccupancyConfig = {
  tramCapacity: number;
  baseAlightingRate: number;
  transferStationAlightingBoost: number;
  centerStationAlightingBoost: number;
  terminalAlightingRate: number;
  universityMorningAlightingBoost: number;
  industrialMorningAlightingBoost: number;
  eveningCenterAlightingBoost: number;
  firstStationAlightingRate: number;
  lastStationAlightingRate: number;
  /** İniş oranı yumuşatma / güven birleştirme (0–1). */
  smoothingFactor: number;
  minAlightingRate: number;
  maxAlightingRate: number;
  centerStationGroupId: string;
  universityAnchorStationGroupId: string;
  industrialAnchorStationGroupId: string;
  morningPeakHours: readonly number[];
  eveningPeakHours: readonly number[];
  transferConfidencePenalty: number;
};

export type AlightingEstimatorParams = {
  boarding: PlatformBoardingEstimate;
  onboardBeforeArrival: number;
  date: string;
  hour: number;
  direction: StationDirection;
  lineId: string;
  network: TransitNetwork;
  sequenceIndex: number;
  lineLength: number;
  isFirst: boolean;
  isLast: boolean;
  config: SegmentOccupancyConfig;
};
