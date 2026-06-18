/**
 * demoStationPassages.ts
 *
 * getEstimatedStationPassages() fonksiyonunun demo/test çalıştırması.
 * UI'a bağlanmaz. Terminal/Node ortamında çalışır.
 *
 * NOT: Tüm sonuçlar "sefer çizelgesi + tahmini offset" yöntemiyle üretilmiştir.
 * Gerçek zamanlı araç konumu yansıtmaz; ±3-5 dakika sapma olabilir.
 *
 * Çalıştırmak için (ts-node kuruluysa):
 *   npx ts-node src/transitNetwork/demoStationPassages.ts
 */

import {
  getEstimatedStationPassages,
  getStationLineCoverage,
  type EstimatedStationPassage,
} from './stationPassageUtils';

// ---------------------------------------------------------------------------
// Yardımcı: konsol çıktısı
// ---------------------------------------------------------------------------

function printHeader(title: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printPassage(p: EstimatedStationPassage): void {
  const confLabel = { high: '✓✓', medium: '✓', low: '~' }[p.confidence];
  console.log(
    `  ${p.estimatedPassageTime}  [${p.lineId} ${p.direction.padEnd(5)}]` +
      `  terminal kalkış: ${p.terminalDepartureTime}` +
      `  +${String(p.offsetMinutes).padStart(2)}dk  ${confLabel}`,
  );
}

function printCoverage(stationId: string, stationName: string): void {
  const coverage = getStationLineCoverage(stationId);
  if (coverage.length === 0) {
    console.log(`  ${stationName} (${stationId}): hiçbir hatta bulunamadı.`);
    return;
  }
  console.log(`  ${stationName} (${stationId}) — ${coverage.length} hat/yön:`);
  for (const c of coverage) {
    console.log(
      `    ${c.lineId} ${c.direction.padEnd(5)} | terminal: ${c.terminalStationName.padEnd(25)} | offset: +${c.offsetMinutes}dk`,
    );
  }
}

// ---------------------------------------------------------------------------
// Demo senaryoları
// Tarih: hafta içi (Salı) — weekday tarifesi kullanılır
// ---------------------------------------------------------------------------

// Hafta içi bir gün (Salı)
const DEMO_DATE = new Date(2026, 5, 16); // 16 Haziran 2026, Salı
const DEMO_HOUR = 16; // 16:xx saati

// Demo durakları
const DEMO_STATIONS: Array<{ id: string; name: string }> = [
  { id: '1006019', name: 'Cumhuriyet Meydanı' },
  { id: '1006023', name: 'Alpaslan' },
  { id: '1006043', name: 'İldem 5' },
];

// ---------------------------------------------------------------------------
// 1. Cumhuriyet Meydanı — 16:xx
// ---------------------------------------------------------------------------
printHeader('Demo 1: Cumhuriyet Meydanı (1006019) — 16:xx');
console.log('  [TAHMİNİ — sefer çizelgesi + koordinat bazlı offset]\n');
{
  const passages = getEstimatedStationPassages({
    stationId: '1006019',
    date: DEMO_DATE,
    hour: DEMO_HOUR,
    minute: 0,
  });
  if (passages.length === 0) {
    console.log('  Bu saat diliminde geçiş bulunamadı.');
  } else {
    passages.forEach(printPassage);
    console.log(`\n  Toplam: ${passages.length} tahmini geçiş`);
  }
}

// ---------------------------------------------------------------------------
// 2. Alpaslan — 16:xx
// ---------------------------------------------------------------------------
printHeader('Demo 2: Alpaslan (1006023) — 16:xx');
console.log('  [TAHMİNİ — sefer çizelgesi + koordinat bazlı offset]\n');
{
  const passages = getEstimatedStationPassages({
    stationId: '1006023',
    date: DEMO_DATE,
    hour: DEMO_HOUR,
    minute: 0,
  });
  if (passages.length === 0) {
    console.log('  Bu saat diliminde geçiş bulunamadı.');
  } else {
    passages.forEach(printPassage);
    console.log(`\n  Toplam: ${passages.length} tahmini geçiş`);
  }
}

// ---------------------------------------------------------------------------
// 3. İldem 5 — 16:xx
// ---------------------------------------------------------------------------
printHeader('Demo 3: İldem 5 (1006043) — 16:xx');
console.log('  [TAHMİNİ — sefer çizelgesi + koordinat bazlı offset]\n');
{
  const passages = getEstimatedStationPassages({
    stationId: '1006043',
    date: DEMO_DATE,
    hour: DEMO_HOUR,
    minute: 0,
  });
  if (passages.length === 0) {
    console.log('  Bu saat diliminde geçiş bulunamadı.');
  } else {
    passages.forEach(printPassage);
    console.log(`\n  Toplam: ${passages.length} tahmini geçiş`);
  }
}

// ---------------------------------------------------------------------------
// 4. Çok hatlı durakların hat kapsama özeti
// Cumhuriyet Meydanı (T1+T2+T3+T4), Alpaslan (T1+T3), İldem 5 (T1+T3)
// ---------------------------------------------------------------------------
printHeader('Demo 4: Çok hatlı duraklar — hat kapsama özeti');
console.log('  [Her durağa hizmet veren hat/yön listesi]\n');
for (const s of DEMO_STATIONS) {
  printCoverage(s.id, s.name);
  console.log();
}

// ---------------------------------------------------------------------------
// 5. Ek: Alpaslan — Pazar günü (sunday tarifesi)
// ---------------------------------------------------------------------------
printHeader('Demo 5: Alpaslan (1006023) — Pazar 10:xx');
console.log('  [TAHMİNİ — sunday tarifesi kullanılır]\n');
{
  const sundayDate = new Date(2026, 5, 14); // 14 Haziran 2026, Pazar
  const passages = getEstimatedStationPassages({
    stationId: '1006023',
    date: sundayDate,
    hour: 10,
    minute: 0,
  });
  if (passages.length === 0) {
    console.log('  Bu saat diliminde geçiş bulunamadı.');
  } else {
    passages.forEach(printPassage);
    console.log(`\n  Toplam: ${passages.length} tahmini geçiş`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log('  Demo tamamlandı.');
console.log('  Kaynak: schedule_plus_estimated_offset');
console.log('  Güven: ✓✓ yüksek | ✓ orta | ~ düşük');
console.log('─'.repeat(60) + '\n');
