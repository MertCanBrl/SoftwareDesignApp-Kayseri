/**
 * Heuristic segment doluluk demo — gerçek ölçüm değil, karar destek tahmini.
 * Çalıştırma: npm run demo-segment-occupancy
 */
import { estimateDirectionSplit } from '../directionSplit/directionSplitEngine';
import type { DirectionSplitInput } from '../directionSplit/directionSplitTypes';
import { getDayTypeFromDate, isWeekendFromDate } from '../directionSplit/directionSplitUtils';
import { buildTransitNetwork } from '../transitNetwork/buildTransitNetwork';
import { getStationGroupById } from '../transitNetwork/transitNetworkUtils';
import {
  DEFAULT_TRAM_LINE_ID,
  DEFAULT_TRANSIT_DIRECTION_CONFIG,
} from '../transitNetwork/transitNetworkTypes';
import { estimateSegmentOccupancy, getTopRiskSegments } from './segmentOccupancyEngine';
import type { SegmentOccupancySegment } from './segmentOccupancyTypes';
import { directionSplitToPlatformBoardingsForDirection } from './segmentOccupancyUtils';

const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;

type SampleStation = {
  stationGroupId: string;
  totalPassengerCount: number;
};

const SAMPLE_STATIONS: SampleStation[] = [
  { stationGroupId: '1006001', totalPassengerCount: 540 },
  { stationGroupId: '1006005', totalPassengerCount: 380 },
  { stationGroupId: '1006010', totalPassengerCount: 450 },
  { stationGroupId: '1006015', totalPassengerCount: 520 },
  { stationGroupId: '1006018', totalPassengerCount: 755 },
  { stationGroupId: '1006019', totalPassengerCount: 1200 },
  { stationGroupId: '1006020', totalPassengerCount: 680 },
  { stationGroupId: '1006025', totalPassengerCount: 420 },
  { stationGroupId: '1006028', totalPassengerCount: 890 },
  { stationGroupId: '1006035', totalPassengerCount: 360 },
  { stationGroupId: '1006048', totalPassengerCount: 1100 },
  { stationGroupId: '1006057', totalPassengerCount: 950 },
  { stationGroupId: '1006066', totalPassengerCount: 290 },
  { stationGroupId: '1006070', totalPassengerCount: 340 },
  { stationGroupId: '1006075', totalPassengerCount: 310 },
];

function buildSplitInput(
  stationGroupId: string,
  totalPassengerCount: number,
  date: string,
  hour: number,
  network: ReturnType<typeof buildTransitNetwork>
): DirectionSplitInput {
  const group = getStationGroupById(stationGroupId, network);
  if (!group) throw new Error(`Unknown station: ${stationGroupId}`);
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

function printTopSegments(
  label: string,
  segments: readonly SegmentOccupancySegment[]
): void {
  console.log(`\n=== ${label} — en riskli ${segments.length} segment (heuristic tahmin) ===\n`);
  for (const s of segments) {
    console.log(`${s.fromStationName} → ${s.toStationName}`);
    console.log(`  onboardAfterDeparture: ${s.onboardAfterDeparture}`);
    console.log(
      `  occupancyRate: ${(s.occupancyRate * 100).toFixed(1)}%  riskLevel: ${s.riskLevel}`
    );
    console.log(`  confidence: ${s.confidence}`);
    console.log(`  reasons: ${s.reasons.join(', ')}`);
    console.log('');
  }
}

function main(): void {
  const network = buildTransitNetwork();
  const date = '2025-03-12';
  const hour = 17;

  console.log('=== Segment Occupancy Demo (estimated, not measured) ===');
  console.log(`date=${date} hour=${hour} line=${DEFAULT_TRAM_LINE_ID}\n`);

  const splitResults = SAMPLE_STATIONS.map((s) =>
    estimateDirectionSplit(buildSplitInput(s.stationGroupId, s.totalPassengerCount, date, hour, network), network)
  );

  for (const direction of [directionA, directionB] as const) {
    const boardings = directionSplitToPlatformBoardingsForDirection(splitResults, direction, network);
    const boardingTotal = boardings.reduce((sum, b) => sum + b.passengerCount, 0);

    console.log(`--- ${direction}: ${boardings.length} platform boarding estimates, sum=${boardingTotal} ---`);

    const occupancy = estimateSegmentOccupancy({
      date,
      hour,
      direction,
      lineId: DEFAULT_TRAM_LINE_ID,
      platformBoardings: boardings,
      network,
    });

    const top = getTopRiskSegments(occupancy, 10);
    printTopSegments(direction, top);
  }

  console.log('=== Demo tamamlandı ===');
}

main();
