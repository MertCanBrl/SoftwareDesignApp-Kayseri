import { getTopCapacityIssues } from './capacityIssueDetector';
import type { ActionPlan } from './municipalityTypes';
import type {
  CapacityIssue,
  ChronicCongestionIssue,
  LowDemandIssue,
  MunicipalityReport,
  MunicipalityRecommendation,
  MunicipalityReportSectionSummaries,
} from './municipalityTypes';
import { formatHourLabel } from './municipalityTextUtils';

export const MUNICIPALITY_REPORT_ASSUMPTIONS: readonly string[] = [
  'Yolcu iniş verisi bulunmadığı için segment dolulukları tahminidir.',
  'Yön dağılımı heuristic olarak yapılmıştır.',
  'Kararlar nihai operasyon planı değil, karar destek önerisidir.',
];

export function generateMunicipalityReport(params: {
  date: string;
  hour: number;
  capacityIssues: readonly CapacityIssue[];
  lowDemandIssues: readonly LowDemandIssue[];
  chronicCongestionIssues: readonly ChronicCongestionIssue[];
  recommendations: readonly MunicipalityRecommendation[];
  actionPlan: ActionPlan;
  contextSummary?: readonly string[];
}): MunicipalityReport {
  const {
    date,
    hour,
    capacityIssues,
    lowDemandIssues,
    chronicCongestionIssues,
    recommendations,
    actionPlan,
    contextSummary,
  } = params;

  const topCapacityIssues = getTopCapacityIssues(capacityIssues, 10);
  const affectedStations = collectUnique(
    [
      ...capacityIssues.flatMap((i) => [i.fromStationName, i.toStationName]),
      ...lowDemandIssues.flatMap((i) => [i.fromStationName, i.toStationName]),
      ...recommendations.flatMap((r) => r.relatedStationNames),
    ].sort()
  );
  const affectedSegments = collectUnique([
    ...capacityIssues.map((i) => i.segmentId),
    ...lowDemandIssues.map((i) => i.segmentId),
    ...recommendations.map((r) => r.segmentId),
  ]);

  const sectionSummaries = buildSectionSummaries(actionPlan);

  const summary = buildSummary({
    date,
    hour,
    capacityIssueCount: capacityIssues.length,
    lowDemandCount: lowDemandIssues.length,
    rawRecommendationCount: actionPlan.totalOriginalRecommendations,
    aggregatedCount: actionPlan.totalAggregatedRecommendations,
    criticalCount: actionPlan.criticalActions.length,
    highCount: actionPlan.highPriorityActions.length,
  });

  const assumptions = [...MUNICIPALITY_REPORT_ASSUMPTIONS];
  if (contextSummary?.length) {
    assumptions.push('Analiz takvim, etkinlik ve hava bağlamı ile zenginleştirilmiştir (mock/configurable kaynak).');
  }

  return {
    summary,
    topCapacityIssues,
    lowDemandIssues,
    chronicCongestionIssues,
    recommendations,
    actionPlan,
    sectionSummaries,
    affectedStations,
    affectedSegments,
    generatedAt: new Date().toISOString(),
    assumptions,
    contextSummary: contextSummary?.length ? [...contextSummary] : undefined,
    date,
    hour,
  };
}

function buildSectionSummaries(plan: ActionPlan): MunicipalityReportSectionSummaries {
  return {
    criticalExtraService: summarizeActions(
      plan.criticalActions,
      'Kritik ek sefer önerisi bulunmamaktadır.'
    ),
    frequencyIncreaseCorridors: summarizeActions(
      plan.highPriorityActions.filter((a) => a.type === 'INCREASE_FREQUENCY'),
      'Sefer sıklığı artırımı gerektiren koridor tespit edilmedi.'
    ),
    monitoringSegments: summarizeActions(
      plan.monitoringActions,
      'İzleme gerektiren segment tespit edilmedi.'
    ),
    costSavingOpportunities: summarizeActions(
      plan.costSavingActions,
      'Düşük talep nedeniyle tasarruf fırsatı tespit edilmedi.'
    ),
    transferPlatformManagement: summarizeActions(
      plan.transferManagementActions,
      'Aktarma/peron yönetimi önerisi bulunmamaktadır.'
    ),
  };
}

function summarizeActions(
  actions: readonly { message: string }[],
  emptyText: string
): string {
  if (!actions.length) return emptyText;
  if (actions.length === 1) return actions[0]!.message;
  return `${actions.length} aksiyon: ${actions.map((a) => a.message).join(' | ')}`;
}

function buildSummary(params: {
  date: string;
  hour: number;
  capacityIssueCount: number;
  lowDemandCount: number;
  rawRecommendationCount: number;
  aggregatedCount: number;
  criticalCount: number;
  highCount: number;
}): string {
  const {
    date,
    hour,
    capacityIssueCount,
    lowDemandCount,
    rawRecommendationCount,
    aggregatedCount,
    criticalCount,
    highCount,
  } = params;
  const hourLabel = formatHourLabel(hour);

  const parts = [
    `${date} tarihinde ${hourLabel} saati için belediye karar destek analizi tamamlandı.`,
    `${capacityIssueCount} kapasite riski, ${lowDemandCount} düşük talep segmenti tespit edildi.`,
    `${rawRecommendationCount} ham öneri ${aggregatedCount} yönetilebilir aksiyona indirgendi`,
  ];

  if (criticalCount > 0 || highCount > 0) {
    parts.push(`(${criticalCount} kritik ek sefer, ${highCount} yüksek öncelikli aksiyon)`);
  }

  parts.push('Aksiyon planı aşağıdaki bölümlerde özetlenmiştir.');

  return parts.join(' ');
}

function collectUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
