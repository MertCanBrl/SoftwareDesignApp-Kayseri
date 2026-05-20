import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { LowDemandIssue } from './municipalityTypes';

/** Doluluk oranı bu eşiğin altındaysa düşük talep kabul edilir. */
export const LOW_DEMAND_OCCUPANCY_THRESHOLD = 0.3;

/**
 * Aynı saat diliminde birden fazla düşük talep segmenti varsa frekans azaltma önerilebilir.
 */
export const LOW_DEMAND_REDUCE_FREQUENCY_MIN_COUNT = 2;

export function detectLowDemandIssues(
  segmentResults: readonly SegmentOccupancyResult[]
): LowDemandIssue[] {
  const candidates: LowDemandIssue[] = [];

  for (const result of segmentResults) {
    for (const segment of result.segments) {
      if (segment.occupancyRate >= LOW_DEMAND_OCCUPANCY_THRESHOLD) continue;

      candidates.push({
        segmentId: segment.segmentId,
        fromStationName: segment.fromStationName,
        toStationName: segment.toStationName,
        direction: segment.direction,
        lineId: segment.lineId,
        hour: result.hour,
        date: result.date,
        occupancyRate: segment.occupancyRate,
        onboardAfterDeparture: segment.onboardAfterDeparture,
        reason: `Tahmini doluluk %${formatPercent(segment.occupancyRate)} — düşük talep aralığında.`,
        suggestReduceFrequency: false,
      });
    }
  }

  const suggestReduce =
    candidates.length >= LOW_DEMAND_REDUCE_FREQUENCY_MIN_COUNT;

  return candidates
    .map((issue) => ({
      ...issue,
      suggestReduceFrequency: suggestReduce,
      reason: suggestReduce
        ? `${issue.reason} Aynı saatte birden fazla düşük talep segmenti tespit edildi; frekans azaltımı değerlendirilebilir.`
        : issue.reason,
    }))
    .sort((a, b) => a.occupancyRate - b.occupancyRate);
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(0);
}
