import type { OccupancyRiskLevel } from '../segmentOccupancy/segmentOccupancyTypes';
import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { CapacityIssue, RecommendationPriority } from './municipalityTypes';

const RISK_TO_PRIORITY: Record<
  Exclude<OccupancyRiskLevel, 'LOW'>,
  RecommendationPriority
> = {
  OVER_CAPACITY: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
};

const RISK_REASON: Record<Exclude<OccupancyRiskLevel, 'LOW'>, string> = {
  OVER_CAPACITY: 'Segment kapasite üstü doluluk tahmini — acil müdahale gerekebilir.',
  HIGH: 'Segment yüksek doluluk tahmini — frekans veya kapasite artırımı değerlendirilmeli.',
  MEDIUM: 'Segment orta düzey doluluk — izleme ve erken uyarı önerilir.',
};

function isActionableRisk(riskLevel: OccupancyRiskLevel): riskLevel is Exclude<OccupancyRiskLevel, 'LOW'> {
  return riskLevel !== 'LOW';
}

export function detectCapacityIssues(
  segmentResults: readonly SegmentOccupancyResult[]
): CapacityIssue[] {
  const issues: CapacityIssue[] = [];

  for (const result of segmentResults) {
    for (const segment of result.segments) {
      if (!isActionableRisk(segment.riskLevel)) continue;

      issues.push({
        segmentId: segment.segmentId,
        fromStationName: segment.fromStationName,
        toStationName: segment.toStationName,
        direction: segment.direction,
        lineId: segment.lineId,
        hour: result.hour,
        date: result.date,
        occupancyRate: segment.occupancyRate,
        riskLevel: segment.riskLevel,
        priority: RISK_TO_PRIORITY[segment.riskLevel],
        reason: RISK_REASON[segment.riskLevel],
      });
    }
  }

  return issues.sort(compareCapacityIssues);
}

export function compareCapacityIssues(a: CapacityIssue, b: CapacityIssue): number {
  const priorityRank: Record<RecommendationPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const priorityDiff = priorityRank[b.priority] - priorityRank[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return b.occupancyRate - a.occupancyRate;
}

export function getTopCapacityIssues(
  issues: readonly CapacityIssue[],
  limit = 10
): readonly CapacityIssue[] {
  return [...issues].sort(compareCapacityIssues).slice(0, limit);
}
