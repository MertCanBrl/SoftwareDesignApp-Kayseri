import type { CityContext } from '../contextEnrichment/contextTypes';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type {
  MunicipalityRecommendation,
  RecommendationPriority,
} from './municipalityTypes';

const PRIORITY_ORDER: readonly RecommendationPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export function buildContextSummary(cityContext: CityContext): readonly string[] {
  return [
    `Şehir bağlamı etki düzeyi: ${cityContext.overallImpactLevel}`,
    `Gün: ${cityContext.calendar.dayLabel}`,
    ...cityContext.explanationTexts,
  ];
}

export function applyCityContextToRecommendations(
  recommendations: readonly MunicipalityRecommendation[],
  cityContext: CityContext,
  network: TransitNetwork
): MunicipalityRecommendation[] {
  const affectedStationIds = collectAffectedStationIds(cityContext);
  const contextSuffix = pickContextSuffix(cityContext);

  return recommendations.map((rec) => {
    let priority = rec.priority;
    const stationIds = resolveRecommendationStationGroupIds(rec, network);
    const hitsEvent =
      stationIds.some((id) => affectedStationIds.has(id)) && cityContext.events.length > 0;

    if (hitsEvent) {
      priority = elevatePriorityOneLevel(priority);
    }

    if (cityContext.weather.impactLevel === 'HIGH' && rec.type === 'MONITORING_REQUIRED') {
      priority = elevatePriorityOneLevel(priority);
    }

    const message =
      hitsEvent || (contextSuffix && rec.type === 'MONITORING_REQUIRED')
        ? appendContextNote(rec.message, contextSuffix, hitsEvent)
        : rec.message;

    return priority === rec.priority && message === rec.message
      ? rec
      : { ...rec, priority, message };
  });
}

function collectAffectedStationIds(cityContext: CityContext): Set<string> {
  const ids = new Set<string>();
  for (const event of cityContext.events) {
    for (const id of event.affectedStationGroupIds) {
      ids.add(id);
    }
  }
  return ids;
}

function resolveRecommendationStationGroupIds(
  rec: MunicipalityRecommendation,
  network: TransitNetwork
): string[] {
  const names = new Set([rec.fromStationName, rec.toStationName, ...rec.relatedStationNames]);
  const ids: string[] = [];

  for (const group of Object.values(network.stationGroupsById)) {
    if (names.has(group.stationName)) {
      ids.push(group.stationGroupId);
    }
  }

  const [fromPlatformId, toPlatformId] = rec.segmentId.split('>>');
  if (fromPlatformId) {
    const from = network.platformsById[fromPlatformId];
    if (from) ids.push(from.stationGroupId);
  }
  if (toPlatformId) {
    const to = network.platformsById[toPlatformId];
    if (to) ids.push(to.stationGroupId);
  }

  return [...new Set(ids)];
}

function elevatePriorityOneLevel(current: RecommendationPriority): RecommendationPriority {
  const index = PRIORITY_ORDER.indexOf(current);
  if (index < 0 || index >= PRIORITY_ORDER.length - 1) return current;
  return PRIORITY_ORDER[index + 1]!;
}

function pickContextSuffix(cityContext: CityContext): string | null {
  if (cityContext.weather.impactLevel === 'HIGH' && cityContext.weather.rain) {
    return 'Yağışlı hava koşulları izlemeyi güçlendirir.';
  }
  if (cityContext.events.length > 0) {
    const event = cityContext.events[0]!;
    return `${event.locationName} etkinliği (${event.eventName}) operasyonel bağlamda dikkate alınmalıdır.`;
  }
  return null;
}

function appendContextNote(
  message: string,
  suffix: string | null,
  hitsEvent: boolean
): string {
  if (!suffix) return message;
  if (hitsEvent && message.includes(suffix)) return message;
  return `${message} ${suffix}`;
}
