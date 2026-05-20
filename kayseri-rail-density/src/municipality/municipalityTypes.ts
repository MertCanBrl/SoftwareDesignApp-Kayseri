/**
 * Belediye karar destek ve optimizasyon öneri modeli.
 * Tüm tipler JSON-serializable olacak şekilde tasarlanmıştır.
 */

import type { CityContext } from '../contextEnrichment/contextTypes';
import type { OccupancyRiskLevel } from '../segmentOccupancy/segmentOccupancyTypes';
import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { StationDirection, TransitNetwork } from '../transitNetwork/transitNetworkTypes';

export type RecommendationType =
  | 'ADD_SERVICE'
  | 'INCREASE_FREQUENCY'
  | 'REDUCE_FREQUENCY'
  | 'PLATFORM_GUIDANCE'
  | 'TRANSFER_MANAGEMENT'
  | 'MONITORING_REQUIRED';

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MunicipalityRecommendation = {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  date: string;
  hour: number;
  direction: StationDirection;
  segmentId: string;
  fromStationName: string;
  toStationName: string;
  lineId: string;
  occupancyRate: number;
  riskLevel: OccupancyRiskLevel;
  message: string;
  relatedStationNames: readonly string[];
};

/** Ham önerilerin gruplanmış, sunuma uygun özeti. */
export type AggregatedRecommendation = {
  id: string;
  type: RecommendationType;
  types: readonly RecommendationType[];
  priority: RecommendationPriority;
  date: string;
  hour: number;
  direction: StationDirection;
  corridorLabel: string;
  segmentCount: number;
  peakOccupancyRate: number;
  message: string;
  relatedStationNames: readonly string[];
  sourceRecommendationIds: readonly string[];
};

export type RecommendationGroup = {
  groupKey: string;
  type: RecommendationType;
  hour: number;
  direction: StationDirection;
  date: string;
  corridorLabel: string;
  recommendations: readonly MunicipalityRecommendation[];
};

export type ActionPlan = {
  criticalActions: readonly AggregatedRecommendation[];
  highPriorityActions: readonly AggregatedRecommendation[];
  monitoringActions: readonly AggregatedRecommendation[];
  costSavingActions: readonly AggregatedRecommendation[];
  transferManagementActions: readonly AggregatedRecommendation[];
  totalOriginalRecommendations: number;
  totalAggregatedRecommendations: number;
};

export type MunicipalityReportSectionSummaries = {
  criticalExtraService: string;
  frequencyIncreaseCorridors: string;
  monitoringSegments: string;
  costSavingOpportunities: string;
  transferPlatformManagement: string;
};

export type CapacityIssue = {
  segmentId: string;
  fromStationName: string;
  toStationName: string;
  direction: StationDirection;
  lineId: string;
  hour: number;
  date: string;
  occupancyRate: number;
  riskLevel: OccupancyRiskLevel;
  priority: RecommendationPriority;
  reason: string;
};

export type ChronicCongestionIssue = {
  segmentId: string;
  fromStationName: string;
  toStationName: string;
  direction: StationDirection;
  lineId: string;
  affectedHours: readonly number[];
  peakOccupancyRate: number;
  occurrenceCount: number;
  priority: RecommendationPriority;
  reason: string;
};

export type LowDemandIssue = {
  segmentId: string;
  fromStationName: string;
  toStationName: string;
  direction: StationDirection;
  lineId: string;
  hour: number;
  date: string;
  occupancyRate: number;
  onboardAfterDeparture: number;
  reason: string;
  suggestReduceFrequency: boolean;
};

export type MunicipalityReport = {
  summary: string;
  topCapacityIssues: readonly CapacityIssue[];
  lowDemandIssues: readonly LowDemandIssue[];
  chronicCongestionIssues: readonly ChronicCongestionIssue[];
  recommendations: readonly MunicipalityRecommendation[];
  actionPlan: ActionPlan;
  sectionSummaries: MunicipalityReportSectionSummaries;
  affectedStations: readonly string[];
  affectedSegments: readonly string[];
  generatedAt: string;
  assumptions: readonly string[];
  /** Şehir bağlamı (takvim, etkinlik, hava) özeti — yalnızca cityContext verildiğinde dolar. */
  contextSummary?: readonly string[];
  date: string;
  hour: number;
};

export type MunicipalityAnalysisInput = {
  date: string;
  hour: number;
  segmentResults: readonly SegmentOccupancyResult[];
  network: TransitNetwork;
  /** Opsiyonel — verilirse rapor ve öneriler bağlamla zenginleştirilir. */
  cityContext?: CityContext;
};

export type MunicipalityAnalysisResult = {
  date: string;
  hour: number;
  capacityIssues: readonly CapacityIssue[];
  lowDemandIssues: readonly LowDemandIssue[];
  chronicCongestionIssues: readonly ChronicCongestionIssue[];
  /** Ham öneri listesi (geriye dönük uyumluluk için `recommendations` ile aynı). */
  rawRecommendations: readonly MunicipalityRecommendation[];
  recommendations: readonly MunicipalityRecommendation[];
  actionPlan: ActionPlan;
  report: MunicipalityReport;
};
