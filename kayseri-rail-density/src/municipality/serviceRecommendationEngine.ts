import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import { getPlatformById, isTransferStation } from '../transitNetwork/transitNetworkUtils';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type {
  CapacityIssue,
  LowDemandIssue,
  MunicipalityRecommendation,
  RecommendationPriority,
  RecommendationType,
} from './municipalityTypes';
import {
  formatHourLabel,
  formatOccupancyPercent,
  formatSegmentLabel,
} from './municipalityTextUtils';

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

type RecommendationDraft = Omit<MunicipalityRecommendation, 'id'>;

export function generateServiceRecommendations(
  capacityIssues: readonly CapacityIssue[],
  lowDemandIssues: readonly LowDemandIssue[],
  segmentResults: readonly SegmentOccupancyResult[],
  network: TransitNetwork
): MunicipalityRecommendation[] {
  const drafts: RecommendationDraft[] = [];
  const seen = new Set<string>();

  for (const issue of capacityIssues) {
    drafts.push(...recommendationsForCapacityIssue(issue, network, seen));
  }

  addReduceFrequencyByDirection(lowDemandIssues, drafts, seen);

  const chronicDrafts = buildChronicCongestionMonitoring(segmentResults);
  for (const draft of chronicDrafts) {
    const key = `${draft.type}:${draft.segmentId}:${draft.hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push(draft);
  }

  return drafts
    .map((draft, index) => ({
      ...draft,
      id: buildRecommendationId(draft, index),
    }))
    .sort(compareRecommendations);
}

function recommendationsForCapacityIssue(
  issue: CapacityIssue,
  network: TransitNetwork,
  seen: Set<string>
): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  const hourLabel = formatHourLabel(issue.hour);
  const segmentLabel = formatSegmentLabel(issue.fromStationName, issue.toStationName);
  const pct = formatOccupancyPercent(issue.occupancyRate);
  const base = {
    date: issue.date,
    hour: issue.hour,
    direction: issue.direction,
    segmentId: issue.segmentId,
    fromStationName: issue.fromStationName,
    toStationName: issue.toStationName,
    lineId: issue.lineId,
    occupancyRate: issue.occupancyRate,
    riskLevel: issue.riskLevel,
    relatedStationNames: [issue.fromStationName, issue.toStationName] as const,
  };

  const isOverCapacity = issue.riskLevel === 'OVER_CAPACITY' || issue.occupancyRate > 1;
  const isCriticalOverflow = issue.occupancyRate > 1.2;

  if (isCriticalOverflow) {
    addDraft(drafts, seen, {
      ...base,
      type: 'ADD_SERVICE',
      priority: 'CRITICAL',
      message: `${hourLabel} saatinde ${segmentLabel} segmentinde tahmini doluluk %${pct}. Bu saat aralığında ek sefer planlanması önerilir.`,
    });
  } else if (isOverCapacity) {
    addDraft(drafts, seen, {
      ...base,
      type: 'ADD_SERVICE',
      priority: 'HIGH',
      message: `${hourLabel} saatinde ${segmentLabel} segmentinde tahmini doluluk %${pct}. Kapasite baskısı nedeniyle ek sefer planlanması önerilir.`,
    });
  } else if (issue.occupancyRate >= 0.8 && issue.occupancyRate <= 1.0) {
    addDraft(drafts, seen, {
      ...base,
      type: 'INCREASE_FREQUENCY',
      priority: 'HIGH',
      message: `${hourLabel} saatinde ${segmentLabel} segmentinde tahmini doluluk %${pct}. Sefer sıklığının artırılması önerilir.`,
    });
  } else if (issue.riskLevel === 'MEDIUM') {
    addDraft(drafts, seen, {
      ...base,
      type: 'MONITORING_REQUIRED',
      priority: 'MEDIUM',
      message: `${hourLabel} saatinde ${segmentLabel} segmentinde tahmini doluluk %${pct}. Orta düzey yoğunluk — operasyon ekibinin izlemesi önerilir.`,
    });
  }

  if (segmentInvolvesTransferStation(issue.segmentId, network)) {
    const hubKey = resolveTransferHubKey(issue);
    addDraft(drafts, seen, {
      ...base,
      type: 'TRANSFER_MANAGEMENT',
      priority: elevatePriority(issue.priority, 'MEDIUM'),
      message: `${hourLabel} saatinde ${hubKey} aktarma noktasında yoğunluk tahmini %${pct}. Peron yönlendirme ve transfer akış yönetimi önerilir.`,
    }, `TRANSFER_MANAGEMENT:${issue.hour}:${issue.direction}:${hubKey}`);
  }

  return drafts;
}

function segmentInvolvesTransferStation(segmentId: string, network: TransitNetwork): boolean {
  const [fromPlatformId, toPlatformId] = segmentId.split('>>');
  if (!fromPlatformId || !toPlatformId) return false;

  const from = getPlatformById(fromPlatformId, network);
  const to = getPlatformById(toPlatformId, network);
  if (!from || !to) return false;

  return (
    isTransferStation(from.stationGroupId, network) ||
    isTransferStation(to.stationGroupId, network)
  );
}

function buildChronicCongestionMonitoring(
  segmentResults: readonly SegmentOccupancyResult[]
): RecommendationDraft[] {
  if (segmentResults.length < 2) return [];

  const bySegment = new Map<
    string,
    { rates: number[]; sample: SegmentOccupancyResult['segments'][number]; hour: number; date: string }
  >();

  for (const result of segmentResults) {
    for (const segment of result.segments) {
      if (segment.riskLevel === 'LOW') continue;
      const existing = bySegment.get(segment.segmentId);
      if (existing) {
        existing.rates.push(segment.occupancyRate);
      } else {
        bySegment.set(segment.segmentId, {
          rates: [segment.occupancyRate],
          sample: segment,
          hour: result.hour,
          date: result.date,
        });
      }
    }
  }

  const drafts: RecommendationDraft[] = [];
  for (const [, entry] of bySegment) {
    if (entry.rates.length < 2) continue;
    const peak = Math.max(...entry.rates);
    if (peak < 0.8) continue;

    const s = entry.sample;
    drafts.push({
      type: 'MONITORING_REQUIRED',
      priority: 'MEDIUM',
      date: entry.date,
      hour: entry.hour,
      direction: s.direction,
      segmentId: s.segmentId,
      fromStationName: s.fromStationName,
      toStationName: s.toStationName,
      lineId: s.lineId,
      occupancyRate: peak,
      riskLevel: s.riskLevel,
      message: `${formatSegmentLabel(s.fromStationName, s.toStationName)} segmenti birden fazla yön/senaryoda yüksek doluluk gösteriyor (tepe %${formatOccupancyPercent(peak)}). Kronik sıkışma riski için izleme önerilir.`,
      relatedStationNames: [s.fromStationName, s.toStationName],
    });
  }

  return drafts;
}

function addReduceFrequencyByDirection(
  lowDemandIssues: readonly LowDemandIssue[],
  drafts: RecommendationDraft[],
  seen: Set<string>
): void {
  const byDirection = new Map<string, LowDemandIssue[]>();

  for (const issue of lowDemandIssues) {
    if (!issue.suggestReduceFrequency) continue;
    const key = `${issue.date}|${issue.hour}|${issue.direction}`;
    const list = byDirection.get(key) ?? [];
    list.push(issue);
    byDirection.set(key, list);
  }

  for (const [, issues] of byDirection) {
    const sample = issues[0]!;
    const dedupeKey = `REDUCE_FREQUENCY:${sample.date}:${sample.hour}:${sample.direction}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const minRate = Math.min(...issues.map((i) => i.occupancyRate));
    drafts.push({
      type: 'REDUCE_FREQUENCY',
      priority: 'LOW',
      date: sample.date,
      hour: sample.hour,
      direction: sample.direction,
      segmentId: sample.segmentId,
      fromStationName: sample.fromStationName,
      toStationName: sample.toStationName,
      lineId: sample.lineId,
      occupancyRate: minRate,
      riskLevel: 'LOW',
      message: `${formatHourLabel(sample.hour)} saatinde ${issues.length} segmentte düşük talep (en düşük %${formatOccupancyPercent(minRate)}). Sefer sıklığının gözden geçirilmesi önerilir.`,
      relatedStationNames: [...new Set(issues.flatMap((i) => [i.fromStationName, i.toStationName]))],
    });
  }
}

function resolveTransferHubKey(issue: CapacityIssue): string {
  return `${issue.fromStationName} / ${issue.toStationName}`;
}

function addDraft(
  drafts: RecommendationDraft[],
  seen: Set<string>,
  draft: RecommendationDraft,
  customKey?: string
): void {
  const key = customKey ?? `${draft.type}:${draft.segmentId}:${draft.hour}`;
  if (seen.has(key)) return;
  seen.add(key);
  drafts.push(draft);
}

function elevatePriority(
  current: RecommendationPriority,
  floor: RecommendationPriority
): RecommendationPriority {
  return PRIORITY_RANK[current] >= PRIORITY_RANK[floor] ? current : floor;
}

function buildRecommendationId(draft: RecommendationDraft, index: number): string {
  return `${draft.type}-${draft.segmentId}-${draft.hour}-${index}`;
}

export function compareRecommendations(
  a: MunicipalityRecommendation,
  b: MunicipalityRecommendation
): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return b.occupancyRate - a.occupancyRate;
}

export function getTopRecommendations(
  recommendations: readonly MunicipalityRecommendation[],
  limit = 10
): readonly MunicipalityRecommendation[] {
  return [...recommendations].sort(compareRecommendations).slice(0, limit);
}
