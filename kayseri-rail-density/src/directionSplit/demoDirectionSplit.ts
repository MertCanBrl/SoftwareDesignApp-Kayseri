/**
 * Yön ayrımı heuristic demo.
 * Çalıştırma: npm run demo-direction-split
 */
import { buildTransitNetwork } from '../transitNetwork/buildTransitNetwork';
import { getStationGroupById } from '../transitNetwork/transitNetworkUtils';
import { estimateDirectionSplit } from './directionSplitEngine';
import type { DirectionSplitInput, DirectionSplitResult } from './directionSplitTypes';
import { getDayTypeFromDate, isWeekendFromDate } from './directionSplitUtils';

function buildInput(params: {
  stationGroupId: string;
  totalPassengerCount: number;
  date: string;
  hour: number;
}): DirectionSplitInput {
  const network = buildTransitNetwork();
  const group = getStationGroupById(params.stationGroupId, network);
  if (!group) {
    throw new Error(`Unknown stationGroupId: ${params.stationGroupId}`);
  }
  const dayType = getDayTypeFromDate(params.date);
  return {
    stationGroupId: params.stationGroupId,
    stationName: group.stationName,
    totalPassengerCount: params.totalPassengerCount,
    date: params.date,
    hour: params.hour,
    dayType,
    isWeekend: isWeekendFromDate(params.date),
    stationTypes: group.stationTypes,
    isTransferStation: group.isTransferStation,
  };
}

function printResult(label: string, result: DirectionSplitResult): void {
  console.log(`\n--- ${label} ---`);
  console.log(`stationName: ${result.stationName}`);
  console.log(`stationGroupId: ${result.stationGroupId}`);
  console.log(`totalPassengerCount: ${result.totalPassengerCount}`);
  console.log(`split sum: ${result.splits.reduce((s, x) => s + x.passengerCount, 0)}`);
  console.log(`ratio sum: ${result.splits.reduce((s, x) => s + x.ratio, 0).toFixed(4)}`);

  for (const split of result.splits) {
    console.log('');
    console.log(`  platformId: ${split.platformId}`);
    console.log(`  direction: ${split.direction}`);
    console.log(`  ratio: ${split.ratio.toFixed(4)}`);
    console.log(`  passengerCount: ${split.passengerCount}`);
    console.log(`  confidence: ${split.confidence}`);
    console.log(`  reasons: ${split.reasons.join(', ')}`);
  }
}

function main(): void {
  const network = buildTransitNetwork();

  console.log('=== Direction Split Demo ===');

  printResult(
    'Hafta içi akşam — Düvenönü 17:00, toplam 755',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006018',
        totalPassengerCount: 755,
        date: '2025-03-12',
        hour: 17,
      }),
      network
    )
  );

  printResult(
    'Hafta içi sabah — Düvenönü 08:00, toplam 420',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006018',
        totalPassengerCount: 420,
        date: '2025-03-12',
        hour: 8,
      }),
      network
    )
  );

  printResult(
    'Hafta sonu öğle — Düvenönü 12:00, toplam 310',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006018',
        totalPassengerCount: 310,
        date: '2025-03-15',
        hour: 12,
      }),
      network
    )
  );

  printResult(
    'Aktarma — Cumhuriyet Meydanı 18:00, toplam 1200',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006019',
        totalPassengerCount: 1200,
        date: '2025-03-12',
        hour: 18,
      }),
      network
    )
  );

  printResult(
    'Üniversite sabah — Erciyes Üniversitesi 08:00, toplam 890',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006048',
        totalPassengerCount: 890,
        date: '2025-03-12',
        hour: 8,
      }),
      network
    )
  );

  printResult(
    'Sanayi sabah — Organize Sanayi 07:00, toplam 540',
    estimateDirectionSplit(
      buildInput({
        stationGroupId: '1006001',
        totalPassengerCount: 540,
        date: '2025-03-12',
        hour: 7,
      }),
      network
    )
  );

  console.log('\n=== Demo tamamlandı ===');
}

main();
