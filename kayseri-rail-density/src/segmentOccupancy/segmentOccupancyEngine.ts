/**
 * Heuristic segment doluluk motoru.
 * Çıktı "estimated segment occupancy"dir; gerçek vagon sensörü veya AFC iniş verisi değildir.
 */
import { getLinePlatformsByDirection } from '../transitNetwork/transitNetworkUtils';
import { estimateAlightings } from './alightingEstimator';
import { DEFAULT_SEGMENT_OCCUPANCY_CONFIG } from './segmentOccupancyConfig';
import type {
  SegmentOccupancyConfig,
  SegmentOccupancyInput,
  SegmentOccupancyResult,
  SegmentOccupancySegment,
} from './segmentOccupancyTypes';
import {
  calculateOccupancyRate,
  createSegmentId,
  getConfidenceFromInputs,
  getPlatformBoardingMap,
  getRiskLevel,
  minConfidence,
  resolveBoardingForPlatform,
} from './segmentOccupancyUtils';

export function estimateSegmentOccupancy(
  input: SegmentOccupancyInput,
  config: SegmentOccupancyConfig = DEFAULT_SEGMENT_OCCUPANCY_CONFIG
): SegmentOccupancyResult {
  const { date, hour, direction, lineId, platformBoardings, network } = input;
  const platforms = getLinePlatformsByDirection(lineId, direction, network);
  const boardingMap = getPlatformBoardingMap(platformBoardings);
  const lineLength = platforms.length;

  const segments: SegmentOccupancySegment[] = [];
  let onboardBeforeArrival = 0;

  for (let i = 0; i < platforms.length; i += 1) {
    const platform = platforms[i]!;
    const boarding = resolveBoardingForPlatform(platform.platformId, boardingMap, network);
    const isFirst = i === 0;
    const isLast = i === lineLength - 1;

    const alighting = estimateAlightings(
      {
        boarding,
        onboardBeforeArrival,
        date,
        hour,
        direction,
        lineId,
        network,
        sequenceIndex: platform.sequenceIndex,
        lineLength,
        isFirst,
        isLast,
        config,
      },
      config
    );

    const boardingsAtStation = boarding.passengerCount;
    const estimatedAlightingsAtStation = alighting.estimatedAlightings;
    const onboardAfterDeparture = Math.max(
      0,
      onboardBeforeArrival - estimatedAlightingsAtStation
    ) + boardingsAtStation;

    if (i < platforms.length - 1) {
      const next = platforms[i + 1]!;
      const nextBoarding = resolveBoardingForPlatform(next.platformId, boardingMap, network);
      const segmentConfidence = getConfidenceFromInputs(
        [boarding.confidence, alighting.confidence, nextBoarding.confidence],
        config.smoothingFactor
      );
      const occupancyRate = calculateOccupancyRate(onboardAfterDeparture, config.tramCapacity);

      segments.push({
        segmentId: createSegmentId(platform.platformId, next.platformId),
        fromPlatformId: platform.platformId,
        toPlatformId: next.platformId,
        fromStationName: platform.stationName,
        toStationName: next.stationName,
        direction,
        lineId,
        boardingsAtFromStation: boardingsAtStation,
        estimatedAlightingsAtFromStation: estimatedAlightingsAtStation,
        onboardAfterDeparture,
        capacity: config.tramCapacity,
        occupancyRate,
        riskLevel: getRiskLevel(occupancyRate),
        confidence: boarding.isTransferStation
          ? minConfidence(segmentConfidence, 'medium')
          : segmentConfidence,
        reasons: alighting.reasons,
      });
    }

    onboardBeforeArrival = onboardAfterDeparture;
  }

  return {
    date,
    hour,
    direction,
    lineId,
    isEstimated: true,
    segments,
    capacity: config.tramCapacity,
  };
}

export function getTopRiskSegments(
  result: SegmentOccupancyResult,
  limit = 10
): readonly SegmentOccupancySegment[] {
  const riskRank: Record<SegmentOccupancySegment['riskLevel'], number> = {
    OVER_CAPACITY: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return [...result.segments]
    .sort((a, b) => {
      const occDiff = b.occupancyRate - a.occupancyRate;
      if (occDiff !== 0) return occDiff;
      const riskDiff = riskRank[b.riskLevel] - riskRank[a.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return b.onboardAfterDeparture - a.onboardAfterDeparture;
    })
    .slice(0, limit);
}
