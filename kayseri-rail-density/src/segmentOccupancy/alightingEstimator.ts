/**
 * Heuristic iniş tahmini — gerçek iniş verisi yoktur.
 */
import { StationType } from '../transitNetwork/transitNetworkTypes';
import type { AlightingEstimate, AlightingEstimatorParams, AlightingReason } from './segmentOccupancyTypes';
import { DEFAULT_SEGMENT_OCCUPANCY_CONFIG } from './segmentOccupancyConfig';
import {
  clampAlightingRate,
  hasStationTypeInBoarding,
  isEveningPeakHour,
  isMorningPeakHour,
  minConfidence,
} from './segmentOccupancyUtils';

export function estimateAlightings(
  params: AlightingEstimatorParams,
  config = DEFAULT_SEGMENT_OCCUPANCY_CONFIG
): AlightingEstimate {
  const {
    boarding,
    onboardBeforeArrival,
    hour,
    direction,
    sequenceIndex,
    lineLength,
    isFirst,
    isLast,
  } = params;

  const reasons: AlightingReason[] = ['BASE_ALIGHTING_RATE'];
  let rate = config.baseAlightingRate;
  let confidence = boarding.confidence;

  if (isFirst || onboardBeforeArrival <= 0) {
    return {
      platformId: boarding.platformId,
      stationGroupId: boarding.stationGroupId,
      estimatedAlightings: 0,
      alightingRate: 0,
      confidence: boarding.confidence,
      reasons: ['FIRST_STATION_LOW_ALIGHTING'],
    };
  }

  if (isLast) {
    rate = config.lastStationAlightingRate;
    reasons.push('LAST_STATION_HIGH_ALIGHTING');
  }

  if (
    hasStationTypeInBoarding(boarding, StationType.TERMINAL) ||
    (boarding.stationGroupId === config.industrialAnchorStationGroupId && sequenceIndex === 0)
  ) {
    if (!isLast) {
      rate = Math.max(rate, config.terminalAlightingRate * 0.45);
    }
    if (isLast) {
      rate = config.terminalAlightingRate;
    }
    reasons.push('TERMINAL_ALIGHTING');
  }

  if (boarding.stationGroupId === config.centerStationGroupId) {
    rate += config.centerStationAlightingBoost;
    reasons.push('CENTER_STATION_ALIGHTING');
  }

  if (boarding.isTransferStation) {
    rate += config.transferStationAlightingBoost;
    reasons.push('TRANSFER_STATION_ALIGHTING');
    confidence = minConfidence(confidence, 'medium');
  }

  const morningPeak = isMorningPeakHour(hour, config.morningPeakHours);
  const eveningPeak = isEveningPeakHour(hour, config.eveningPeakHours);

  if (
    morningPeak &&
    hasStationTypeInBoarding(boarding, StationType.UNIVERSITY) &&
    isApproachingAnchor(sequenceIndex, config.universityAnchorStationGroupId, params)
  ) {
    rate += config.universityMorningAlightingBoost;
    reasons.push('UNIVERSITY_MORNING_ALIGHTING');
  }

  if (
    morningPeak &&
    hasStationTypeInBoarding(boarding, StationType.INDUSTRIAL) &&
    isApproachingAnchor(sequenceIndex, config.industrialAnchorStationGroupId, params)
  ) {
    rate += config.industrialMorningAlightingBoost;
    reasons.push('INDUSTRIAL_MORNING_ALIGHTING');
  }

  if (
    eveningPeak &&
    boarding.stationGroupId === config.centerStationGroupId
  ) {
    rate += config.eveningCenterAlightingBoost;
    reasons.push('EVENING_CENTER_ALIGHTING');
  }

  if (isLast) {
    rate = Math.max(rate, config.lastStationAlightingRate);
  }

  rate = clampAlightingRate(rate, config.minAlightingRate, config.maxAlightingRate);

  if (config.smoothingFactor > 0) {
    const smoothed = rate * (1 - config.smoothingFactor) + config.baseAlightingRate * config.smoothingFactor;
    rate = clampAlightingRate(smoothed, config.minAlightingRate, config.maxAlightingRate);
    reasons.push('SMOOTHED_RATE');
  }

  let estimatedAlightings = Math.round(onboardBeforeArrival * rate);
  if (estimatedAlightings > onboardBeforeArrival) {
    estimatedAlightings = Math.floor(onboardBeforeArrival);
    reasons.push('CAPPED_BY_ONBOARD');
  }
  if (isLast && onboardBeforeArrival > 0) {
    estimatedAlightings = Math.floor(onboardBeforeArrival);
    rate = onboardBeforeArrival > 0 ? estimatedAlightings / onboardBeforeArrival : rate;
  }

  void direction;
  void lineLength;

  return {
    platformId: boarding.platformId,
    stationGroupId: boarding.stationGroupId,
    estimatedAlightings,
    alightingRate: onboardBeforeArrival > 0 ? estimatedAlightings / onboardBeforeArrival : 0,
    confidence,
    reasons,
  };
}

function isApproachingAnchor(
  sequenceIndex: number,
  anchorStationGroupId: string,
  params: AlightingEstimatorParams
): boolean {
  const anchorPlatform = params.network.platformsById;
  const anchor = Object.values(anchorPlatform).find(
    (p) =>
      p.stationGroupId === anchorStationGroupId &&
      p.direction === params.direction &&
      p.lineId === params.lineId
  );
  if (!anchor) {
    return params.boarding.stationGroupId === anchorStationGroupId;
  }
  return Math.abs(sequenceIndex - anchor.sequenceIndex) <= 2 || params.boarding.stationGroupId === anchorStationGroupId;
}
