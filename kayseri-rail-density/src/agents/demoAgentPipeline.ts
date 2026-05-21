/**
 * Multi-agent pipeline demo.
 * Çalıştırma: npm run demo-agent-pipeline
 */
import { buildTransitNetwork } from '../transitNetwork/buildTransitNetwork';
import type { PassengerRow } from '../types';
import { runTransitDecisionPipeline } from './transitDecisionPipeline';
import type { AgentStepResult } from './agentTypes';

const DEMO_DATE = '2025-03-12';
const DEMO_HOUR = 17;

const SAMPLE_STATIONS: { stationGroupId: string; yolcuSayisi: number }[] = [
  { stationGroupId: '1006001', yolcuSayisi: 540 },
  { stationGroupId: '1006005', yolcuSayisi: 380 },
  { stationGroupId: '1006010', yolcuSayisi: 450 },
  { stationGroupId: '1006015', yolcuSayisi: 520 },
  { stationGroupId: '1006018', yolcuSayisi: 755 },
  { stationGroupId: '1006019', yolcuSayisi: 1200 },
  { stationGroupId: '1006020', yolcuSayisi: 680 },
  { stationGroupId: '1006025', yolcuSayisi: 420 },
  { stationGroupId: '1006028', yolcuSayisi: 890 },
  { stationGroupId: '1006035', yolcuSayisi: 360 },
  { stationGroupId: '1006048', yolcuSayisi: 1100 },
  { stationGroupId: '1006057', yolcuSayisi: 950 },
  { stationGroupId: '1006066', yolcuSayisi: 290 },
  { stationGroupId: '1006070', yolcuSayisi: 340 },
  { stationGroupId: '1006075', yolcuSayisi: 310 },
];

function buildSamplePassengerRows(date: string, hour: number): PassengerRow[] {
  return SAMPLE_STATIONS.map((s) => ({
    tarih: date,
    durakId: s.stationGroupId,
    durakAd: '',
    saat: hour,
    yolcuSayisi: s.yolcuSayisi,
  }));
}

function printStep(step: AgentStepResult, index: number): void {
  console.log(`\n--- Adım ${index + 1}: ${step.agentName} ---`);
  console.log(`status: ${step.status} (${step.durationMs} ms)`);
  console.log(`summary: ${step.summary}`);
  if (step.warnings.length) {
    console.log('warnings:');
    for (const w of step.warnings) {
      console.log(`  • ${w}`);
    }
  }
}

function main(): void {
  const network = buildTransitNetwork();
  const passengerRows = buildSamplePassengerRows(DEMO_DATE, DEMO_HOUR);

  console.log('=== Transit Decision Agent Pipeline Demo ===');
  console.log(`date=${DEMO_DATE} hour=${DEMO_HOUR} passengerRows=${passengerRows.length}\n`);

  const result = runTransitDecisionPipeline({
    date: DEMO_DATE,
    hour: DEMO_HOUR,
    passengerRows,
    network,
  });

  console.log('\n=== Pipeline adımları ===');
  for (const [index, step] of result.steps.entries()) {
    printStep(step, index);
  }

  console.log('\n=== Pipeline sonucu ===');
  console.log(`status: ${result.status}`);
  console.log(`duration: ${result.durationMs} ms`);
  if (result.errorMessage) {
    console.log(`error: ${result.errorMessage}`);
  }

  const exec = result.outputs.executiveSummary;
  if (exec) {
    console.log('\n=== Yönetici Özeti ===\n');
    console.log(exec.headline);
    console.log('');
    console.log(exec.summary);
    console.log('');
    console.log(`Kritik aksiyon: ${exec.criticalActionCount}`);
    console.log(`Yüksek öncelik: ${exec.highPriorityActionCount}`);
    console.log('\nEn riskli koridorlar:');
    for (const corridor of exec.topRiskCorridors.slice(0, 5)) {
      console.log(`  • ${corridor}`);
    }
    console.log('\nDüşük talep fırsatları:');
    if (!exec.lowDemandOpportunities.length) {
      console.log('  (yok)');
    } else {
      for (const item of exec.lowDemandOpportunities) {
        console.log(`  • ${item}`);
      }
    }
    console.log('\nBağlam notları:');
    for (const note of exec.contextNotes) {
      console.log(`  • ${note}`);
    }
    console.log('\nVarsayımlar:');
    for (const assumption of exec.assumptions) {
      console.log(`  • ${assumption}`);
    }
  } else {
    console.log('\n(Yönetici özeti üretilemedi — pipeline başarısız veya eksik adım.)');
  }

  console.log('\n=== Demo tamamlandı ===');
}

main();
