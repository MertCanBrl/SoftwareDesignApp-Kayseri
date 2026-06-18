/**
 * demoPassengerDistribution.ts
 *
 * distributeHourlyPassengersToPassages() fonksiyonunun demo/test çalıştırması.
 * UI'a bağlanmaz. Terminal/Node ortamında çalışır.
 *
 * NOT: Tüm yolcu sayıları tahmindir; gerçek zamanlı veri kullanılmaz.
 *
 * Çalıştırmak için:
 *   npx ts-node src/transitNetwork/demoPassengerDistribution.ts
 */

import type { EstimatedStationPassage } from './stationPassageUtils';
import {
  distributeHourlyPassengersToPassages,
  type PassagePassengerDistribution,
} from './passengerDistributionUtils';

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function makePassage(
  time: string,
  lineId: string,
  direction: 'gidis' | 'donus',
): EstimatedStationPassage {
  return {
    stationId: '1006023',
    lineId,
    direction,
    terminalDepartureTime: '00:00',
    estimatedPassageTime: time,
    offsetMinutes: 0,
    confidence: 'high',
    source: 'schedule_plus_estimated_offset',
  };
}

function printHeader(title: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printDistribution(result: PassagePassengerDistribution[]): void {
  for (const r of result) {
    const dir = r.direction === 'gidis' ? 'Gidiş' : 'Dönüş';
    console.log(
      `  ${r.estimatedPassageTime}  ${r.lineId} ${dir.padEnd(6)}  → ${r.estimatedPassengers} yolcu`,
    );
  }
  const total = result.reduce((s, r) => s + r.estimatedPassengers, 0);
  console.log(`\n  Toplam: ${total} yolcu`);
}

function assertTotal(result: PassagePassengerDistribution[], expected: number): void {
  const total = result.reduce((s, r) => s + r.estimatedPassengers, 0);
  if (total !== expected) {
    console.error(`  ✗ HATA: Beklenen toplam ${expected}, hesaplanan ${total}`);
  } else {
    console.log(`  ✓ Toplam doğru: ${total} === ${expected}`);
  }
}

// ---------------------------------------------------------------------------
// Demo 1: 80 yolcu / 4 geçiş → 20, 20, 20, 20
// ---------------------------------------------------------------------------

printHeader('Demo 1: 80 yolcu, 4 geçiş (tam bölünür)');
{
  const passages = [
    makePassage('16:02', 'T1', 'gidis'),
    makePassage('16:10', 'T1', 'donus'),
    makePassage('16:18', 'T2', 'gidis'),
    makePassage('16:26', 'T2', 'donus'),
  ];
  const result = distributeHourlyPassengersToPassages({
    hourlyPassengerCount: 80,
    passages,
  });
  printDistribution(result);
  assertTotal(result, 80);
}

// ---------------------------------------------------------------------------
// Demo 2: 83 yolcu / 4 geçiş → 20, 20, 20, 23 (toplam: 83)
// ---------------------------------------------------------------------------

printHeader('Demo 2: 83 yolcu, 4 geçiş (küsuratlı — fark son elemana)');
{
  const passages = [
    makePassage('16:02', 'T1', 'gidis'),
    makePassage('16:10', 'T1', 'donus'),
    makePassage('16:18', 'T2', 'gidis'),
    makePassage('16:26', 'T2', 'donus'),
  ];
  const result = distributeHourlyPassengersToPassages({
    hourlyPassengerCount: 83,
    passages,
  });
  printDistribution(result);
  assertTotal(result, 83);
}

// ---------------------------------------------------------------------------
// Demo 3: 0 yolcu → hepsi 0
// ---------------------------------------------------------------------------

printHeader('Demo 3: 0 yolcu (tüm geçişler 0 yolcu)');
{
  const passages = [
    makePassage('16:02', 'T1', 'gidis'),
    makePassage('16:15', 'T1', 'donus'),
  ];
  const result = distributeHourlyPassengersToPassages({
    hourlyPassengerCount: 0,
    passages,
  });
  printDistribution(result);
  assertTotal(result, 0);
}

// ---------------------------------------------------------------------------
// Demo 4: Boş geçiş listesi → boş array
// ---------------------------------------------------------------------------

printHeader('Demo 4: Boş geçiş listesi → boş array');
{
  const result = distributeHourlyPassengersToPassages({
    hourlyPassengerCount: 80,
    passages: [],
  });
  if (result.length === 0) {
    console.log('  ✓ Boş geçiş → boş array döndü');
  } else {
    console.error(`  ✗ HATA: ${result.length} eleman döndü, 0 bekleniyor`);
  }
}

// ---------------------------------------------------------------------------
// Demo 5: Tek geçiş → tüm yolcu o geçişe
// ---------------------------------------------------------------------------

printHeader('Demo 5: 57 yolcu, 1 geçiş → tamamı tek geçişe');
{
  const passages = [makePassage('16:08', 'T1', 'gidis')];
  const result = distributeHourlyPassengersToPassages({
    hourlyPassengerCount: 57,
    passages,
  });
  printDistribution(result);
  assertTotal(result, 57);
}

console.log('\n' + '─'.repeat(60));
console.log('  Demo tamamlandı.');
console.log('  Kaynak: eşit dağıtım, yuvarlama farkı son elemanda');
console.log('─'.repeat(60) + '\n');
