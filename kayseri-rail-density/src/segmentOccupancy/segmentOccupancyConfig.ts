import type { SegmentOccupancyConfig } from './segmentOccupancyTypes';

/** Varsayılan heuristic segment doluluk / iniş modeli ayarları. */
export const DEFAULT_SEGMENT_OCCUPANCY_CONFIG: SegmentOccupancyConfig = {
  tramCapacity: 350,
  baseAlightingRate: 0.18,
  transferStationAlightingBoost: 0.12,
  centerStationAlightingBoost: 0.1,
  terminalAlightingRate: 0.65,
  universityMorningAlightingBoost: 0.14,
  industrialMorningAlightingBoost: 0.14,
  eveningCenterAlightingBoost: 0.11,
  firstStationAlightingRate: 0.03,
  lastStationAlightingRate: 0.88,
  smoothingFactor: 0.12,
  minAlightingRate: 0.02,
  maxAlightingRate: 0.95,
  centerStationGroupId: '1006019',
  universityAnchorStationGroupId: '1006048',
  industrialAnchorStationGroupId: '1006001',
  morningPeakHours: [7, 8, 9],
  eveningPeakHours: [17, 18, 19],
  transferConfidencePenalty: 0.15,
};
