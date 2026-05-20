import { buildCityContext } from '../contextEnrichment/cityContextEngine';
import type { CityContext } from '../contextEnrichment/contextTypes';
import type { AgentRunOutcome } from './agentPipelineUtils';

export type CityContextAgentInput = {
  date: string;
  hour: number;
};

export function runCityContextAgent(input: CityContextAgentInput): AgentRunOutcome<CityContext> {
  const cityContext = buildCityContext(input.date, input.hour);
  const eventCount = cityContext.events.length;

  return {
    output: cityContext,
    summary: `Şehir bağlamı üretildi (etki=${cityContext.overallImpactLevel}, ${eventCount} aktif etkinlik).`,
    warnings:
      cityContext.overallImpactLevel === 'HIGH'
        ? ['Şehir bağlamı etki düzeyi yüksek — operasyonel dikkat önerilir.']
        : [],
  };
}
