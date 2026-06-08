/**
 * 2025 hava durumu + tatil verisini birleştirir ve 2026 tatil feature datasını üretir.
 *
 * Çıktılar:
 *   assets/data/weather/2025/{district}-hourly-weather-holidays-2025.json
 *   assets/data/weather/2025/kayseri-districts-hourly-weather-holidays-2025.json
 *   assets/data/holidays/kayseri-holiday-features-2025.json
 *   assets/data/holidays/kayseri-holiday-features-2026.json
 *
 * npm run build:holiday-dataset
 * npm run build:holiday-dataset -- --force
 */
import fs from 'fs';
import path from 'path';
import {
  buildHolidayFeatureRows,
  enrichWeatherWithHolidayData,
  getHolidaysForYear,
} from '../src/holidays/holidayLoader';
import type { WeatherRow } from '../src/types';
import type { HolidayFeatureRow } from '../src/holidays/holidayTypes';
import type { WeatherHolidayRow } from '../src/types';

const PROJECT_ROOT = path.join(__dirname, '..');
const WEATHER_DIR = path.join(PROJECT_ROOT, 'assets', 'data', 'weather', '2025');
const HOLIDAYS_DIR = path.join(PROJECT_ROOT, 'assets', 'data', 'holidays');
const FORCE = process.argv.includes('--force');

const DISTRICTS = ['melikgazi', 'talas', 'kocasinan'] as const;

// ── Dosya okuma / yazma ───────────────────────────────────────────────────────

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dosya bulunamadı: ${filePath}\nÖnce "npm run fetch:weather" komutunu çalıştırın.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch (e) {
    throw new Error(`JSON yazma hatası: ${filePath}: ${e}`);
  }
}

function writeCsv(filePath: string, rows: WeatherHolidayRow[]): void {
  const header =
    'district,date,time,datetime,temperature,precipitation,rain,snowfall,windSpeed,windGusts,windDirection,' +
    'isOfficialHoliday,isReligiousHoliday,isNationalHoliday,isHolidayEve,' +
    'holidayName,holidayType,holidayDuration,expectedTransitImpact,' +
    'dayOfWeek,month,season,explanationText';

  const lines = rows.map((r) =>
    [
      r.district,
      r.date,
      r.time,
      r.datetime,
      r.temperature,
      r.precipitation,
      r.rain,
      r.snowfall,
      r.windSpeed,
      r.windGusts,
      r.windDirection,
      r.isOfficialHoliday ? 1 : 0,
      r.isReligiousHoliday ? 1 : 0,
      r.isNationalHoliday ? 1 : 0,
      r.isHolidayEve ? 1 : 0,
      r.holidayName ?? '',
      r.holidayType ?? '',
      r.holidayDuration ?? '',
      r.expectedTransitImpact ?? '',
      r.dayOfWeek,
      r.month,
      r.season,
      `"${(r.explanationText ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  try {
    fs.writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf8');
  } catch (e) {
    throw new Error(`CSV yazma hatası: ${filePath}: ${e}`);
  }
}

function writeHolidayFeatureCsv(filePath: string, rows: HolidayFeatureRow[]): void {
  const header =
    'date,isOfficialHoliday,isReligiousHoliday,isNationalHoliday,isHolidayEve,' +
    'holidayName,holidayType,holidayDuration,expectedTransitImpact,' +
    'dayOfWeek,month,season,explanationText';

  const lines = rows.map((r) =>
    [
      r.date,
      r.isOfficialHoliday ? 1 : 0,
      r.isReligiousHoliday ? 1 : 0,
      r.isNationalHoliday ? 1 : 0,
      r.isHolidayEve ? 1 : 0,
      r.holidayName ?? '',
      r.holidayType ?? '',
      r.holidayDuration ?? '',
      r.expectedTransitImpact ?? '',
      r.dayOfWeek,
      r.month,
      r.season,
      `"${(r.explanationText ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  fs.writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf8');
}

function outputsExist(...paths: string[]): boolean {
  return paths.every((p) => fs.existsSync(p));
}

// ── 2025 hava + tatil zenginleştirme ─────────────────────────────────────────

function buildWeather2025(): WeatherHolidayRow[] {
  const holidays2025 = getHolidaysForYear(2025);
  const allEnriched: WeatherHolidayRow[] = [];

  for (const district of DISTRICTS) {
    const jsonOut = path.join(WEATHER_DIR, `${district}-hourly-weather-holidays-2025.json`);
    const csvOut = path.join(WEATHER_DIR, `${district}-hourly-weather-holidays-2025.csv`);

    if (!FORCE && outputsExist(jsonOut, csvOut)) {
      console.log(`[skip]  ${district}: dosyalar mevcut (--force ile yeniden oluştur)`);
      const cached = readJson<WeatherHolidayRow[]>(jsonOut);
      allEnriched.push(...cached);
      continue;
    }

    process.stdout.write(`[build] ${district} ... `);
    const source = readJson<WeatherRow[]>(
      path.join(WEATHER_DIR, `${district}-hourly-weather-2025.json`)
    );

    const enriched = enrichWeatherWithHolidayData(source, holidays2025);
    writeJson(jsonOut, enriched);
    writeCsv(csvOut, enriched);
    allEnriched.push(...enriched);
    console.log(`${enriched.length} satır`);
  }

  // Birleşik dosya
  const combinedJson = path.join(WEATHER_DIR, 'kayseri-districts-hourly-weather-holidays-2025.json');
  const combinedCsv = path.join(WEATHER_DIR, 'kayseri-districts-hourly-weather-holidays-2025.csv');

  if (FORCE || !outputsExist(combinedJson, combinedCsv)) {
    process.stdout.write('[write] kayseri-districts birleşik ... ');
    writeJson(combinedJson, allEnriched);
    writeCsv(combinedCsv, allEnriched);
    console.log(`${allEnriched.length} satır`);
  } else {
    console.log('[skip]  kayseri-districts birleşik: mevcut');
  }

  return allEnriched;
}

// ── Tatil feature satırları ───────────────────────────────────────────────────

function buildHolidayFeatures(year: 2025 | 2026): void {
  const jsonOut = path.join(HOLIDAYS_DIR, `kayseri-holiday-features-${year}.json`);
  const csvOut = path.join(HOLIDAYS_DIR, `kayseri-holiday-features-${year}.csv`);

  if (!FORCE && outputsExist(jsonOut, csvOut)) {
    console.log(`[skip]  holiday-features-${year}: dosyalar mevcut`);
    return;
  }

  process.stdout.write(`[build] holiday-features-${year} ... `);
  const holidays = getHolidaysForYear(year);
  const rows = buildHolidayFeatureRows(year, holidays);

  writeJson(jsonOut, rows);
  writeHolidayFeatureCsv(csvOut, rows);

  const holidayCount = rows.filter((r) => r.isOfficialHoliday).length;
  const eveCount = rows.filter((r) => r.isHolidayEve && !r.isOfficialHoliday).length;
  console.log(`${rows.length} gün (${holidayCount} tatil, ${eveCount} arife)`);
}

// ── Ana akış ─────────────────────────────────────────────────────────────────

function main(): void {
  fs.mkdirSync(WEATHER_DIR, { recursive: true });
  fs.mkdirSync(HOLIDAYS_DIR, { recursive: true });

  console.log('=== 2025 Hava Durumu + Tatil Zenginleştirme ===');
  const enriched = buildWeather2025();

  console.log('\n=== Tatil Feature Satırları ===');
  buildHolidayFeatures(2025);
  buildHolidayFeatures(2026);

  // Özet istatistikler
  const holidayRows = enriched.filter((r) => r.isOfficialHoliday);
  const religiousRows = enriched.filter((r) => r.isReligiousHoliday);
  const eveRows = enriched.filter((r) => r.isHolidayEve && !r.isOfficialHoliday);
  const weatherImpactRows = enriched.filter(
    (r) => r.precipitation > 3 || r.snowfall > 0.3 || r.windSpeed > 40
  );

  console.log('\n=== Özet ===');
  console.log(`  Toplam saatlik satır : ${enriched.length}`);
  console.log(`  Tatil saatleri       : ${holidayRows.length}`);
  console.log(`  Dini bayram saatleri : ${religiousRows.length}`);
  console.log(`  Arife saatleri       : ${eveRows.length}`);
  console.log(`  Hava etkili saatler  : ${weatherImpactRows.length}`);
  console.log(`\n  Çıktı dizinleri:`);
  console.log(`    ${WEATHER_DIR}`);
  console.log(`    ${HOLIDAYS_DIR}`);
}

main();
