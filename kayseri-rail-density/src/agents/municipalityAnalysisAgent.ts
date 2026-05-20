import type { CityContext } from '../contextEnrichment/contextTypes';
import { runMunicipalityAnalysis } from '../municipality/municipalityAnalysisEngine';
import type { MunicipalityAnalysisResult } from '../municipality/municipalityTypes';
import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type { AgentRunOutcome } from './agentPipelineUtils';

export type MunicipalityAnalysisAgentInput = {
  date: string;
  hour: number;
  segmentResults: readonly SegmentOccupancyResult[];
  network: TransitNetwork;
  cityContext: CityContext;
};

export function runMunicipalityAnalysisAgent(
  input: MunicipalityAnalysisAgentInput
): AgentRunOutcome<MunicipalityAnalysisResult> {
  const analysis = runMunicipalityAnalysis({
    date: input.date,
    hour: input.hour,
    segmentResults: input.segmentResults,
    network: input.network,
    cityContext: input.cityContext,
  });

  const { actionPlan, capacityIssues, lowDemandIssues } = analysis;

  return {
    output: analysis,
    summary: `Belediye analizi tamamlandı (${capacityIssues.length} kapasite riski, ${lowDemandIssues.length} düşük talep, ${actionPlan.totalAggregatedRecommendations} aksiyon).`,
    warnings: [],
  };
}
