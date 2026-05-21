/**
 * Belediye karar destek demo — segment doluluk tahminlerinden öneri üretir.
 * Çalıştırma: npm run demo-municipality-analysis
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
import { estimateSegmentOccupancy } from '../segmentOccupancy/segmentOccupancyEngine';
import { directionSplitToPlatformBoardingsForDirection } from '../segmentOccupancy/segmentOccupancyUtils';
import { runMunicipalityAnalysis } from './municipalityAnalysisEngine';
import { flattenActionPlan } from './recommendationAggregator';

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

function main(): void {
  const network = buildTransitNetwork();
  const date = '2025-03-12';
  const hour = 17;

  console.log('=== Belediye Karar Destek Analizi Demo ===');
  console.log(`date=${date} hour=${hour} line=${DEFAULT_TRAM_LINE_ID}\n`);

  const splitResults = SAMPLE_STATIONS.map((s) =>
    estimateDirectionSplit(buildSplitInput(s.stationGroupId, s.totalPassengerCount, date, hour, network), network)
  );

  const segmentResults = ([directionA, directionB] as const).map((direction) => {
    const boardings = directionSplitToPlatformBoardingsForDirection(splitResults, direction, network);
    return estimateSegmentOccupancy({
      date,
      hour,
      direction,
      lineId: DEFAULT_TRAM_LINE_ID,
      platformBoardings: boardings,
      network,
    });
  });

  const analysis = runMunicipalityAnalysis({
    date,
    hour,
    segmentResults,
    network,
  });

  const { actionPlan, report } = analysis;
  const topActions = flattenActionPlan(actionPlan).slice(0, 10);

  console.log('--- Özet ---\n');
  console.log(report.summary);
  console.log('\nVarsayımlar:');
  for (const assumption of report.assumptions) {
    console.log(`  • ${assumption}`);
  }

  console.log('\n--- Bölüm özetleri ---\n');
  console.log(`Kritik ek sefer: ${report.sectionSummaries.criticalExtraService}`);
  console.log(`Frekans artırımı: ${report.sectionSummaries.frequencyIncreaseCorridors}`);
  console.log(`İzleme: ${report.sectionSummaries.monitoringSegments}`);
  console.log(`Tasarruf: ${report.sectionSummaries.costSavingOpportunities}`);
  console.log(`Aktarma/peron: ${report.sectionSummaries.transferPlatformManagement}`);

  console.log('\n--- İlk 10 aksiyon (gruplanmış) ---\n');
  if (!topActions.length) {
    console.log('(Aksiyon üretilmedi)\n');
  } else {
    for (const [index, action] of topActions.entries()) {
      console.log(`${index + 1}. [${action.priority}] ${action.type} (${action.segmentCount} segment)`);
      console.log(`   ${action.message}`);
      console.log('');
    }
  }

  console.log('--- İstatistik ---');
  console.log(`Ham öneri: ${actionPlan.totalOriginalRecommendations}`);
  console.log(`Gruplanmış aksiyon: ${actionPlan.totalAggregatedRecommendations}`);
  console.log(`Kritik aksiyon: ${actionPlan.criticalActions.length}`);
  console.log(`Tasarruf fırsatı: ${actionPlan.costSavingActions.length}`);
  console.log(`Aktarma yönetimi: ${actionPlan.transferManagementActions.length}`);
  console.log(`Kapasite riskleri: ${analysis.capacityIssues.length}`);
  console.log(`Düşük talep segmentleri: ${analysis.lowDemandIssues.length}`);
  console.log('\n=== Demo tamamlandı ===');
}

main();
