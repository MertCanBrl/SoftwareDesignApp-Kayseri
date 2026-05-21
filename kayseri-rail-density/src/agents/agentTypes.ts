/**
 * Deterministic multi-agent pipeline tipleri — JSON-serializable.
 */

import type { CityContext } from '../contextEnrichment/contextTypes';
import type { DirectionSplitResult } from '../directionSplit/directionSplitTypes';
import type { MunicipalityAnalysisResult } from '../municipality/municipalityTypes';
import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import type { PassengerRow } from '../types';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';

export type AgentName =
  | 'CITY_CONTEXT_AGENT'
  | 'DIRECTION_SPLIT_AGENT'
  | 'SEGMENT_OCCUPANCY_AGENT'
  | 'MUNICIPALITY_ANALYSIS_AGENT'
  | 'REPORT_AGENT';

export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type AgentStepResult = {
  agentName: AgentName;
  status: AgentStatus;
  startedAt: string;
  finishedAt: string;
  /** Adım süresi (ms). */
  durationMs: number;
  summary: string;
  warnings: readonly string[];
  output: unknown;
};

export type AgentPipelineInput = {
  date: string;
  hour: number;
  passengerRows: readonly PassengerRow[];
  network: TransitNetwork;
};

export type ExecutiveSummary = {
  headline: string;
  summary: string;
  criticalActionCount: number;
  highPriorityActionCount: number;
  topRiskCorridors: readonly string[];
  lowDemandOpportunities: readonly string[];
  contextNotes: readonly string[];
  assumptions: readonly string[];
};

export type AgentPipelineOutputs = {
  cityContext?: CityContext;
  splitResults?: readonly DirectionSplitResult[];
  segmentResults?: readonly SegmentOccupancyResult[];
  municipalityAnalysis?: MunicipalityAnalysisResult;
  executiveSummary?: ExecutiveSummary;
};

export type AgentPipelineResult = {
  date: string;
  hour: number;
  status: AgentStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: readonly AgentStepResult[];
  outputs: AgentPipelineOutputs;
  errorMessage?: string;
};
