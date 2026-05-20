import { getTopCapacityIssues } from '../municipality/capacityIssueDetector';
import type { MunicipalityAnalysisResult } from '../municipality/municipalityTypes';
import { flattenActionPlan } from '../municipality/recommendationAggregator';
import { formatHourLabel, formatOccupancyPercent } from '../municipality/municipalityTextUtils';
import type { ExecutiveSummary } from './agentTypes';
import type { AgentRunOutcome } from './agentPipelineUtils';

export function runReportAgent(
  analysis: MunicipalityAnalysisResult
): AgentRunOutcome<ExecutiveSummary> {
  const executiveSummary = buildExecutiveSummary(analysis);

  return {
    output: executiveSummary,
    summary: 'Yönetici özeti üretildi.',
    warnings: [],
  };
}

function buildExecutiveSummary(analysis: MunicipalityAnalysisResult): ExecutiveSummary {
  const { date, hour, actionPlan, report, capacityIssues, lowDemandIssues } = analysis;

  const criticalActionCount = actionPlan.criticalActions.length;
  const highPriorityActionCount =
    actionPlan.highPriorityActions.length + actionPlan.transferManagementActions.length;

  const topCapacity = getTopCapacityIssues(capacityIssues, 5);
  const topRiskCorridors = topCapacity.map(
    (issue) =>
      `${issue.fromStationName} → ${issue.toStationName} (%${formatOccupancyPercent(issue.occupancyRate)})`
  );

  const lowDemandOpportunities = lowDemandIssues
    .filter((i) => i.suggestReduceFrequency)
    .slice(0, 5)
    .map(
      (issue) =>
        `${issue.fromStationName} → ${issue.toStationName} (%${formatOccupancyPercent(issue.occupancyRate)})`
    );

  if (!lowDemandOpportunities.length && actionPlan.costSavingActions.length) {
    for (const action of actionPlan.costSavingActions.slice(0, 3)) {
      lowDemandOpportunities.push(action.corridorLabel);
    }
  }

  const contextNotes = report.contextSummary?.length
    ? [...report.contextSummary]
    : ['Şehir bağlamı özeti rapora eklenmedi.'];

  const assumptions = [...report.assumptions];
  const hourLabel = formatHourLabel(hour);

  const flattened = flattenActionPlan(actionPlan);
  const monitoringCount = actionPlan.monitoringActions.length;

  const summaryParts = [
    `${date} tarihinde ${hourLabel} saati için tramvay karar destek analizi tamamlandı.`,
    `${criticalActionCount} kritik ve ${highPriorityActionCount} yüksek öncelikli aksiyon önerildi; ${monitoringCount} izleme kalemi listelendi.`,
  ];

  if (topRiskCorridors.length) {
    summaryParts.push(
      `En riskli koridorlar: ${topRiskCorridors.slice(0, 3).join('; ')}.`
    );
  } else {
    summaryParts.push('Belirgin kapasite aşımı koridoru tespit edilmedi.');
  }

  if (lowDemandOpportunities.length) {
    summaryParts.push(
      `Tasarruf/değerlendirme fırsatları: ${lowDemandOpportunities.slice(0, 3).join('; ')}.`
    );
  }

  if (contextNotes[0] !== 'Şehir bağlamı özeti rapora eklenmedi.') {
    summaryParts.push(`Bağlam: ${contextNotes[0]}`);
  }

  if (flattened.length) {
    const top = flattened[0]!;
    summaryParts.push(`Öncelikli öneri: [${top.priority}] ${top.message}`);
  }

  summaryParts.push('Bu çıktı tahmin modeli değil; heuristic segment doluluk ve kural tabanlı önerilerdir.');

  return {
    headline: `${date} ${hourLabel} — Tramvay Operasyon Özeti`,
    summary: summaryParts.join(' '),
    criticalActionCount,
    highPriorityActionCount,
    topRiskCorridors,
    lowDemandOpportunities,
    contextNotes,
    assumptions,
  };
}
