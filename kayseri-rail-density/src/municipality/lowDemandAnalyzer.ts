import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { LowDemandIssue } from './municipalityTypes';

/** Doluluk oranı bu eşiğin altındaysa düşük talep kabul edilir. */
export const LOW_DEMAND_OCCUPANCY_THRESHOLD = 0.3;

/**
 * Aynı hat üzerinde frekans azaltımını engelleyen minimum risk seviyesi.
 * Aynı hatta HIGH veya OVER_CAPACITY segment varsa o hat için frekans azaltımı önerilmez.
 */
const BLOCKING_RISK_LEVELS = new Set(['HIGH', 'OVER_CAPACITY']);

/**
 * Aynı saat diliminde birden fazla düşük talep segmenti varsa frekans azaltma önerilebilir,
 * ancak aynı hatta kapasite baskısı olan segment yoksa.
 */
export const LOW_DEMAND_REDUCE_FREQUENCY_MIN_COUNT = 2;

export function detectLowDemandIssues(
  segmentResults: readonly SegmentOccupancyResult[]
): LowDemandIssue[] {
  // Hat düzeyinde kapasite riski olan lineId'leri topla
  const linesWithCapacityRisk = new Set<string>();
  for (const result of segmentResults) {
    for (const segment of result.segments) {
      if (BLOCKING_RISK_LEVELS.has(segment.riskLevel)) {
        linesWithCapacityRisk.add(segment.lineId);
      }
    }
  }

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

  const enoughCandidates = candidates.length >= LOW_DEMAND_REDUCE_FREQUENCY_MIN_COUNT;

  return candidates
    .map((issue) => {
      const lineBlocked = linesWithCapacityRisk.has(issue.lineId);
      const canReduce = enoughCandidates && !lineBlocked;

      let reason = issue.reason;
      if (enoughCandidates && lineBlocked) {
        reason += ` Ancak ${issue.lineId} hattının başka segmentlerinde kapasite baskısı mevcut; hat frekansı azaltılamaz.`;
      } else if (canReduce) {
        reason += ` Aynı saatte birden fazla düşük talep segmenti tespit edildi; frekans azaltımı değerlendirilebilir.`;
      }

      return { ...issue, suggestReduceFrequency: canReduce, reason };
    })
    .sort((a, b) => a.occupancyRate - b.occupancyRate);
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(0);
}
