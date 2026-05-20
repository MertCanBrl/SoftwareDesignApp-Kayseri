import type { DirectionSplitResult } from '../directionSplit/directionSplitTypes';
import { estimateSegmentOccupancy } from '../segmentOccupancy/segmentOccupancyEngine';
import type { SegmentOccupancyResult } from '../segmentOccupancy/segmentOccupancyTypes';
import { directionSplitToPlatformBoardingsForDirection } from '../segmentOccupancy/segmentOccupancyUtils';
import {
  DEFAULT_TRAM_LINE_ID,
  DEFAULT_TRANSIT_DIRECTION_CONFIG,
} from '../transitNetwork/transitNetworkTypes';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type { AgentRunOutcome } from './agentPipelineUtils';

const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;

export type SegmentOccupancyAgentInput = {
  date: string;
  hour: number;
  splitResults: readonly DirectionSplitResult[];
  network: TransitNetwork;
};

export type SegmentOccupancyAgentOutput = {
  segmentResults: readonly SegmentOccupancyResult[];
};

export function runSegmentOccupancyAgent(
  input: SegmentOccupancyAgentInput
): AgentRunOutcome<SegmentOccupancyAgentOutput> {
  const { date, hour, splitResults, network } = input;
  const warnings: string[] = [];

  if (!splitResults.length) {
    warnings.push('Yön dağılımı sonucu boş — segment doluluk tahmini sınırlı olacaktır.');
  }

  const segmentResults = ([directionA, directionB] as const).map((direction) => {
    const boardings = directionSplitToPlatformBoardingsForDirection(
      splitResults,
      direction,
      network
    );
    return estimateSegmentOccupancy({
      date,
      hour,
      direction,
      lineId: DEFAULT_TRAM_LINE_ID,
      platformBoardings: boardings,
      network,
    });
  });

  const highRiskCount = segmentResults.reduce(
    (sum, r) => sum + r.segments.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'OVER_CAPACITY').length,
    0
  );

  return {
    output: { segmentResults },
    summary: `İki yön için segment doluluk tahmini tamamlandı (${highRiskCount} yüksek/kapasite üstü segment).`,
    warnings,
  };
}
