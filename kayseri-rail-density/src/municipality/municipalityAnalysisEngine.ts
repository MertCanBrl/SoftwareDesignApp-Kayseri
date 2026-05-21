import { detectCapacityIssues } from './capacityIssueDetector';
import { detectLowDemandIssues } from './lowDemandAnalyzer';
import {
  applyCityContextToRecommendations,
  buildContextSummary,
} from './municipalityContextIntegration';
import { generateMunicipalityReport } from './municipalityReportGenerator';
import { aggregateRecommendations } from './recommendationAggregator';
import { generateServiceRecommendations } from './serviceRecommendationEngine';
import type {
  ChronicCongestionIssue,
  MunicipalityAnalysisInput,
  MunicipalityAnalysisResult,
} from './municipalityTypes';

/**
 * Segment doluluk çıktılarından belediye karar destek analizi üretir.
 */
export function runMunicipalityAnalysis(
  input: MunicipalityAnalysisInput
): MunicipalityAnalysisResult {
  const { date, hour, segmentResults, network, cityContext } = input;

  const capacityIssues = detectCapacityIssues(segmentResults);
  const lowDemandIssues = detectLowDemandIssues(segmentResults);
  const chronicCongestionIssues = detectChronicCongestionIssues(segmentResults);
  const baseRecommendations = generateServiceRecommendations(
    capacityIssues,
    lowDemandIssues,
    segmentResults,
    network
  );
  const rawRecommendations = cityContext
    ? applyCityContextToRecommendations(baseRecommendations, cityContext, network)
    : baseRecommendations;
  const actionPlan = aggregateRecommendations(rawRecommendations);
  const contextSummary = cityContext ? buildContextSummary(cityContext) : undefined;

  const report = generateMunicipalityReport({
    date,
    hour,
    capacityIssues,
    lowDemandIssues,
    chronicCongestionIssues,
    recommendations: rawRecommendations,
    actionPlan,
    contextSummary,
  });

  return {
    date,
    hour,
    capacityIssues,
    lowDemandIssues,
    chronicCongestionIssues,
    rawRecommendations,
    recommendations: rawRecommendations,
    actionPlan,
    report,
  };
}

/**
 * Birden fazla yön/senaryo sonucunda aynı segmentte tekrarlayan yüksek doluluk.
 */
function detectChronicCongestionIssues(
  segmentResults: readonly MunicipalityAnalysisInput['segmentResults'][number][]
): ChronicCongestionIssue[] {
  const bySegment = new Map<
    string,
    {
      rates: number[];
      hours: number[];
      sample: (typeof segmentResults)[number]['segments'][number];
      date: string;
    }
  >();

  for (const result of segmentResults) {
    for (const segment of result.segments) {
      if (segment.riskLevel === 'LOW' || segment.riskLevel === 'MEDIUM') continue;

      const existing = bySegment.get(segment.segmentId);
      if (existing) {
        existing.rates.push(segment.occupancyRate);
        existing.hours.push(result.hour);
      } else {
        bySegment.set(segment.segmentId, {
          rates: [segment.occupancyRate],
          hours: [result.hour],
          sample: segment,
          date: result.date,
        });
      }
    }
  }

  const issues: ChronicCongestionIssue[] = [];

  for (const [, entry] of bySegment) {
    if (entry.rates.length < 2) continue;

    const peakOccupancyRate = Math.max(...entry.rates);
    if (peakOccupancyRate < 0.8) continue;

    const s = entry.sample;
    const priority =
      peakOccupancyRate > 1.2 ? 'CRITICAL' : peakOccupancyRate > 1 ? 'HIGH' : 'MEDIUM';

    issues.push({
      segmentId: s.segmentId,
      fromStationName: s.fromStationName,
      toStationName: s.toStationName,
      direction: s.direction,
      lineId: s.lineId,
      affectedHours: [...new Set(entry.hours)].sort((a, b) => a - b),
      peakOccupancyRate,
      occurrenceCount: entry.rates.length,
      priority,
      reason: `${s.fromStationName} → ${s.toStationName} segmenti analiz kapsamında ${entry.rates.length} kez yüksek dolulukla eşleşti (tepe %${(peakOccupancyRate * 100).toFixed(0)}).`,
    });
  }

  return issues.sort((a, b) => b.peakOccupancyRate - a.peakOccupancyRate);
}
