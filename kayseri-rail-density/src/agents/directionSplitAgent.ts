import { estimateDirectionSplit } from '../directionSplit/directionSplitEngine';
import type { DirectionSplitInput, DirectionSplitResult } from '../directionSplit/directionSplitTypes';
import { getDayTypeFromDate, isWeekendFromDate } from '../directionSplit/directionSplitUtils';
import type { PassengerRow } from '../types';
import { getStationGroupById } from '../transitNetwork/transitNetworkUtils';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import type { AgentRunOutcome } from './agentPipelineUtils';
import { aggregatePassengerCountsByStation } from './passengerRowUtils';

export type DirectionSplitAgentInput = {
  date: string;
  hour: number;
  passengerRows: readonly PassengerRow[];
  network: TransitNetwork;
};

export type DirectionSplitAgentOutput = {
  splitResults: readonly DirectionSplitResult[];
  stationCount: number;
  skippedStations: readonly string[];
};

export function runDirectionSplitAgent(
  input: DirectionSplitAgentInput
): AgentRunOutcome<DirectionSplitAgentOutput> {
  const { date, hour, passengerRows, network } = input;
  const totals = aggregatePassengerCountsByStation(passengerRows, date, hour);
  const warnings: string[] = [];
  const skippedStations: string[] = [];
  const splitResults: DirectionSplitResult[] = [];

  if (totals.size === 0) {
    warnings.push(`${date} ${hour}:00 için yolcu satırı bulunamadı.`);
  }

  for (const [stationGroupId, totalPassengerCount] of totals) {
    const splitInput = buildSplitInput(
      stationGroupId,
      totalPassengerCount,
      date,
      hour,
      network
    );

    if (!splitInput) {
      skippedStations.push(stationGroupId);
      continue;
    }

    splitResults.push(estimateDirectionSplit(splitInput, network));
  }

  if (skippedStations.length) {
    warnings.push(
      `${skippedStations.length} durak ağda bulunamadı ve atlandı: ${skippedStations.slice(0, 5).join(', ')}${skippedStations.length > 5 ? '…' : ''}`
    );
  }

  const totalPassengers = splitResults.reduce((s, r) => s + r.totalPassengerCount, 0);

  return {
    output: { splitResults, stationCount: splitResults.length, skippedStations },
    summary: `${splitResults.length} durak için yön dağılımı hesaplandı (toplam ${totalPassengers} yolcu).`,
    warnings,
  };
}

function buildSplitInput(
  stationGroupId: string,
  totalPassengerCount: number,
  date: string,
  hour: number,
  network: TransitNetwork
): DirectionSplitInput | null {
  const group = getStationGroupById(stationGroupId, network);
  if (!group) return null;

  return {
    stationGroupId,
    stationName: group.stationName,
    totalPassengerCount,
    date,
    hour,
    dayType: getDayTypeFromDate(date),
    isWeekend: isWeekendFromDate(date),
    stationTypes: group.stationTypes,
    isTransferStation: group.isTransferStation,
  };
}
