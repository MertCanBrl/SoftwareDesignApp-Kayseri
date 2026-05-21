import type {
  AgentPipelineInput,
  AgentPipelineOutputs,
  AgentPipelineResult,
  AgentStepResult,
} from './agentTypes';
import { runAgentStep, resolvePipelineStatus, skippedAgentStep } from './agentPipelineUtils';
import { runCityContextAgent } from './cityContextAgent';
import type { CityContext } from '../contextEnrichment/contextTypes';
import { runDirectionSplitAgent, type DirectionSplitAgentOutput } from './directionSplitAgent';
import { runMunicipalityAnalysisAgent } from './municipalityAnalysisAgent';
import { runReportAgent } from './reportAgent';
import { runSegmentOccupancyAgent, type SegmentOccupancyAgentOutput } from './segmentOccupancyAgent';
import type { ExecutiveSummary } from './agentTypes';
import type { MunicipalityAnalysisResult } from '../municipality/municipalityTypes';

/**
 * Deterministic agent pipeline — mevcut analiz modüllerini sırayla çalıştırır.
 */
export function runTransitDecisionPipeline(input: AgentPipelineInput): AgentPipelineResult {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const steps: AgentStepResult[] = [];
  const outputs: AgentPipelineOutputs = {};

  let cityContext: CityContext | undefined;
  let splitOutput: DirectionSplitAgentOutput | undefined;
  let segmentOutput: SegmentOccupancyAgentOutput | undefined;
  let analysis: MunicipalityAnalysisResult | undefined;
  let executiveSummary: ExecutiveSummary | undefined;
  let errorMessage: string | undefined;

  const cityStep = runAgentStep('CITY_CONTEXT_AGENT', () =>
    runCityContextAgent({ date: input.date, hour: input.hour })
  );
  steps.push(cityStep);

  if (cityStep.status === 'COMPLETED' && cityStep.output) {
    cityContext = cityStep.output as CityContext;
    outputs.cityContext = cityContext;
  } else {
    errorMessage = cityStep.summary;
  }

  if (cityContext) {
    const splitStep = runAgentStep('DIRECTION_SPLIT_AGENT', () =>
      runDirectionSplitAgent({
        date: input.date,
        hour: input.hour,
        passengerRows: input.passengerRows,
        network: input.network,
      })
    );
    steps.push(splitStep);

    if (splitStep.status === 'COMPLETED' && splitStep.output) {
      splitOutput = splitStep.output as DirectionSplitAgentOutput;
      outputs.splitResults = splitOutput.splitResults;
    } else {
      errorMessage = splitStep.summary;
    }
  } else {
    steps.push(
      skippedAgentStep('DIRECTION_SPLIT_AGENT', 'Şehir bağlamı adımı başarısız — atlandı.')
    );
  }

  if (splitOutput?.splitResults) {
    const segmentStep = runAgentStep('SEGMENT_OCCUPANCY_AGENT', () =>
      runSegmentOccupancyAgent({
        date: input.date,
        hour: input.hour,
        splitResults: splitOutput!.splitResults,
        network: input.network,
      })
    );
    steps.push(segmentStep);

    if (segmentStep.status === 'COMPLETED' && segmentStep.output) {
      segmentOutput = segmentStep.output as SegmentOccupancyAgentOutput;
      outputs.segmentResults = segmentOutput.segmentResults;
    } else {
      errorMessage = segmentStep.summary;
    }
  } else {
    steps.push(
      skippedAgentStep('SEGMENT_OCCUPANCY_AGENT', 'Yön dağılımı adımı tamamlanmadı — atlandı.')
    );
  }

  if (cityContext && segmentOutput?.segmentResults) {
    const municipalityStep = runAgentStep('MUNICIPALITY_ANALYSIS_AGENT', () =>
      runMunicipalityAnalysisAgent({
        date: input.date,
        hour: input.hour,
        segmentResults: segmentOutput!.segmentResults,
        network: input.network,
        cityContext,
      })
    );
    steps.push(municipalityStep);

    if (municipalityStep.status === 'COMPLETED' && municipalityStep.output) {
      analysis = municipalityStep.output as MunicipalityAnalysisResult;
      outputs.municipalityAnalysis = analysis;
    } else {
      errorMessage = municipalityStep.summary;
    }
  } else {
    steps.push(
      skippedAgentStep(
        'MUNICIPALITY_ANALYSIS_AGENT',
        'Segment doluluk veya şehir bağlamı eksik — atlandı.'
      )
    );
  }

  if (analysis) {
    const reportStep = runAgentStep('REPORT_AGENT', () => runReportAgent(analysis!));
    steps.push(reportStep);

    if (reportStep.status === 'COMPLETED' && reportStep.output) {
      executiveSummary = reportStep.output as ExecutiveSummary;
      outputs.executiveSummary = executiveSummary;
    } else {
      errorMessage = reportStep.summary;
    }
  } else {
    steps.push(skippedAgentStep('REPORT_AGENT', 'Belediye analizi tamamlanmadı — atlandı.'));
  }

  const status = resolvePipelineStatus(steps);
  const finishedAt = new Date().toISOString();

  return {
    date: input.date,
    hour: input.hour,
    status,
    startedAt,
    finishedAt,
    durationMs: Date.now() - startMs,
    steps,
    outputs,
    errorMessage: status === 'FAILED' ? errorMessage : undefined,
  };
}
