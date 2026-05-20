import type {
  ActionPlan,
  AggregatedRecommendation,
  MunicipalityRecommendation,
  RecommendationGroup,
  RecommendationPriority,
  RecommendationType,
} from './municipalityTypes';
import { formatHourLabel, formatOccupancyPercent, formatSegmentLabel } from './municipalityTextUtils';

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const TYPE_STRENGTH: Record<RecommendationType, number> = {
  ADD_SERVICE: 5,
  INCREASE_FREQUENCY: 4,
  TRANSFER_MANAGEMENT: 3,
  PLATFORM_GUIDANCE: 3,
  MONITORING_REQUIRED: 2,
  REDUCE_FREQUENCY: 1,
};

export type AggregateRecommendationsOptions = {
  topN?: number;
};

const DEFAULT_TOP_N = 15;

export function aggregateRecommendations(
  recommendations: readonly MunicipalityRecommendation[],
  options: AggregateRecommendationsOptions = {}
): ActionPlan {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const deduped = dedupeCompetingPerSegment(recommendations);
  const groups = buildGroups(deduped);
  const aggregated = groups.map(groupToAggregated).sort(compareAggregated);

  const fullPlan = buildActionPlan(aggregated, recommendations.length);
  const capped = selectBalancedTopN(fullPlan, topN);
  return buildActionPlan(capped, recommendations.length);
}

/** Aynı segmentte çakışan önerilerden en güçlüsünü bırakır. */
function dedupeCompetingPerSegment(
  recommendations: readonly MunicipalityRecommendation[]
): MunicipalityRecommendation[] {
  const bySegment = new Map<string, MunicipalityRecommendation[]>();

  for (const rec of recommendations) {
    const list = bySegment.get(rec.segmentId) ?? [];
    list.push(rec);
    bySegment.set(rec.segmentId, list);
  }

  const result: MunicipalityRecommendation[] = [];

  for (const [, segmentRecs] of bySegment) {
    const capacityTypes: RecommendationType[] = [
      'ADD_SERVICE',
      'INCREASE_FREQUENCY',
      'MONITORING_REQUIRED',
    ];
    const capacityRecs = segmentRecs.filter((r) => capacityTypes.includes(r.type));
    const otherRecs = segmentRecs.filter((r) => !capacityTypes.includes(r.type));

    if (capacityRecs.length > 0) {
      result.push(pickStrongestRecommendation(capacityRecs));
    }

    const transferRecs = otherRecs.filter(
      (r) => r.type === 'PLATFORM_GUIDANCE' || r.type === 'TRANSFER_MANAGEMENT'
    );
    const rest = otherRecs.filter(
      (r) => r.type !== 'PLATFORM_GUIDANCE' && r.type !== 'TRANSFER_MANAGEMENT'
    );

    if (transferRecs.length > 0) {
      result.push(pickStrongestRecommendation(transferRecs));
    }
    result.push(...rest);
  }

  return result;
}

function pickStrongestRecommendation(
  recs: MunicipalityRecommendation[]
): MunicipalityRecommendation {
  return [...recs].sort((a, b) => {
    const typeDiff = TYPE_STRENGTH[b.type] - TYPE_STRENGTH[a.type];
    if (typeDiff !== 0) return typeDiff;
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.occupancyRate - a.occupancyRate;
  })[0]!;
}

function buildGroups(recommendations: readonly MunicipalityRecommendation[]): RecommendationGroup[] {
  const groupMap = new Map<string, RecommendationGroup>();

  for (const rec of recommendations) {
    const key = buildGroupKey(rec);
    const existing = groupMap.get(key);
    if (existing) {
      groupMap.set(key, {
        ...existing,
        recommendations: [...existing.recommendations, rec],
      });
    } else {
      groupMap.set(key, {
        groupKey: key,
        type: rec.type,
        hour: rec.hour,
        direction: rec.direction,
        date: rec.date,
        corridorLabel: resolveCorridorLabel(rec),
        recommendations: [rec],
      });
    }
  }

  return [...groupMap.values()];
}

function buildGroupKey(rec: MunicipalityRecommendation): string {
  if (rec.type === 'REDUCE_FREQUENCY') {
    return `REDUCE|${rec.date}|${rec.hour}|${rec.direction}`;
  }

  if (rec.type === 'PLATFORM_GUIDANCE' || rec.type === 'TRANSFER_MANAGEMENT') {
    const hub = resolveTransferHubName(rec);
    return `TRANSFER|${rec.date}|${rec.hour}|${rec.direction}|${hub}`;
  }

  if (rec.type === 'MONITORING_REQUIRED') {
    return `MONITORING|${rec.date}|${rec.hour}|${rec.direction}`;
  }

  if (rec.type === 'ADD_SERVICE' || rec.type === 'INCREASE_FREQUENCY') {
    return `${rec.type}|${rec.date}|${rec.hour}|${rec.direction}`;
  }

  const corridor = normalizeCorridorKey(rec.fromStationName, rec.toStationName);
  return `${rec.type}|${rec.date}|${rec.hour}|${rec.direction}|${corridor}`;
}

function normalizeCorridorKey(from: string, to: string): string {
  return `${from}→${to}`;
}

function resolveCorridorLabel(rec: MunicipalityRecommendation): string {
  if (rec.type === 'PLATFORM_GUIDANCE' || rec.type === 'TRANSFER_MANAGEMENT') {
    return resolveTransferHubName(rec);
  }
  return formatSegmentLabel(rec.fromStationName, rec.toStationName);
}

function resolveTransferHubName(rec: MunicipalityRecommendation): string {
  const [from, to] = rec.relatedStationNames;
  if (from && to && from !== to) return `${from} / ${to}`;
  return rec.fromStationName;
}

function groupToAggregated(group: RecommendationGroup): AggregatedRecommendation {
  const peakOccupancyRate = Math.max(...group.recommendations.map((r) => r.occupancyRate));
  let priority = group.recommendations.reduce<RecommendationPriority>(
    (best, r) => (PRIORITY_RANK[r.priority] > PRIORITY_RANK[best] ? r.priority : best),
    group.recommendations[0]!.priority
  );
  const types = collectUniqueTypes(group.recommendations.map((r) => r.type));
  const primaryType = types[0] ?? group.type;

  if (primaryType === 'TRANSFER_MANAGEMENT' || primaryType === 'PLATFORM_GUIDANCE') {
    priority = priority === 'CRITICAL' ? 'HIGH' : priority;
  }

  return {
    id: `agg-${group.groupKey}`,
    type: primaryType,
    types,
    priority,
    date: group.date,
    hour: group.hour,
    direction: group.direction,
    corridorLabel: group.corridorLabel,
    segmentCount: group.recommendations.length,
    peakOccupancyRate,
    message: buildAggregatedMessage(group, peakOccupancyRate),
    relatedStationNames: collectUniqueStations(group.recommendations),
    sourceRecommendationIds: group.recommendations.map((r) => r.id),
  };
}

function buildAggregatedMessage(
  group: RecommendationGroup,
  peakOccupancyRate: number
): string {
  const hourLabel = formatHourLabel(group.hour);
  const pct = formatOccupancyPercent(peakOccupancyRate);
  const corridors = group.recommendations
    .map((r) => formatSegmentLabel(r.fromStationName, r.toStationName))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);
  const corridorText =
    corridors.length === 1
      ? corridors[0]!
      : `${corridors.length} koridor (${corridors.join('; ')})`;
  const countNote =
    group.recommendations.length > 1
      ? ` ${group.recommendations.length} segment birleştirildi.`
      : '';

  switch (group.type) {
    case 'ADD_SERVICE':
      return `${hourLabel} saatinde ${corridorText} üzerinde tahmini tepe doluluk %${pct}. Ek sefer planlanması önerilir.${countNote}`;
    case 'INCREASE_FREQUENCY':
      return `${hourLabel} saatinde ${corridorText} koridorunda tahmini doluluk %${pct}. Sefer sıklığının artırılması önerilir.${countNote}`;
    case 'MONITORING_REQUIRED':
      return `${hourLabel} saatinde ${group.recommendations.length} segment orta-yüksek doluluk gösteriyor (tepe %${pct}). Operasyon ekibi izlemeli.${countNote}`;
    case 'REDUCE_FREQUENCY':
      return `${hourLabel} saatinde ${group.recommendations.length} segmentte düşük talep tespit edildi. Sefer sıklığı azaltımı değerlendirilebilir.${countNote}`;
    case 'PLATFORM_GUIDANCE':
    case 'TRANSFER_MANAGEMENT':
      return `${hourLabel} saatinde ${group.corridorLabel} aktarma noktasında yoğunluk tahmini %${pct}. Peron yönlendirme ve transfer akış yönetimi önerilir.${countNote}`;
    default:
      return group.recommendations[0]!.message;
  }
}

function collectUniqueTypes(types: RecommendationType[]): readonly RecommendationType[] {
  const order: RecommendationType[] = [
    'ADD_SERVICE',
    'INCREASE_FREQUENCY',
    'TRANSFER_MANAGEMENT',
    'PLATFORM_GUIDANCE',
    'MONITORING_REQUIRED',
    'REDUCE_FREQUENCY',
  ];
  const set = new Set(types);
  return order.filter((t) => set.has(t));
}

function collectUniqueStations(recs: readonly MunicipalityRecommendation[]): readonly string[] {
  return [...new Set(recs.flatMap((r) => r.relatedStationNames))];
}

function compareAggregated(a: AggregatedRecommendation, b: AggregatedRecommendation): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return b.peakOccupancyRate - a.peakOccupancyRate;
}

/** Sunum için kategori başına kota ile topN seçer. */
function selectBalancedTopN(plan: ActionPlan, topN: number): AggregatedRecommendation[] {
  const criticalAdd = plan.criticalActions.filter((a) => a.type === 'ADD_SERVICE');
  const transfer = [...plan.transferManagementActions].sort(
    (a, b) => b.peakOccupancyRate - a.peakOccupancyRate
  );

  const queues: AggregatedRecommendation[][] = [
    criticalAdd,
    [...plan.highPriorityActions],
    [...plan.costSavingActions],
    transfer.slice(0, 5),
    [...plan.monitoringActions],
    transfer.slice(5),
  ];

  const picked: AggregatedRecommendation[] = [];
  const seen = new Set<string>();

  while (picked.length < topN) {
    let added = false;
    for (const queue of queues) {
      if (picked.length >= topN) break;
      const next = queue.shift();
      if (!next || seen.has(next.id)) continue;
      seen.add(next.id);
      picked.push(next);
      added = true;
    }
    if (!added) break;
  }

  return picked;
}

function buildActionPlan(
  aggregated: AggregatedRecommendation[],
  totalOriginal: number
): ActionPlan {
  const criticalActions = aggregated.filter(
    (a) => a.type === 'ADD_SERVICE' && a.priority === 'CRITICAL'
  );
  const highPriorityActions = aggregated.filter(
    (a) =>
      (a.type === 'ADD_SERVICE' && a.priority !== 'CRITICAL') ||
      a.type === 'INCREASE_FREQUENCY'
  );
  const transferManagementActions = aggregated.filter(
    (a) => a.type === 'PLATFORM_GUIDANCE' || a.type === 'TRANSFER_MANAGEMENT'
  );
  const monitoringActions = aggregated.filter((a) => a.type === 'MONITORING_REQUIRED');
  const costSavingActions = aggregated.filter((a) => a.type === 'REDUCE_FREQUENCY');

  const totalAggregated =
    criticalActions.length +
    highPriorityActions.length +
    transferManagementActions.length +
    monitoringActions.length +
    costSavingActions.length;

  return {
    criticalActions,
    highPriorityActions,
    monitoringActions,
    costSavingActions,
    transferManagementActions,
    totalOriginalRecommendations: totalOriginal,
    totalAggregatedRecommendations: totalAggregated,
  };
}

/** Action plan içindeki tüm aksiyonları önceliğe göre düz liste. */
export function flattenActionPlan(plan: ActionPlan): AggregatedRecommendation[] {
  return [
    ...plan.criticalActions,
    ...plan.highPriorityActions,
    ...plan.transferManagementActions,
    ...plan.monitoringActions,
    ...plan.costSavingActions,
  ].sort(compareAggregated);
}
