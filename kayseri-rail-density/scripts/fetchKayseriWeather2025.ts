/**
 * One-time script: downloads 2025 hourly historical weather from Open-Meteo
 * for three Kayseri districts used in passenger-density and AI-agent systems.
 *
 * npm run fetch:weather
 * npm run fetch:weather -- --force    (re-download even if files exist)
 */
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'data', 'weather', '2025');
const FORCE = process.argv.includes('--force');

const START_DATE = '2025-01-01';
const END_DATE = '2025-12-31';
const TIMEZONE = 'Europe/Istanbul';

const HOURLY_VARS = [
  'temperature_2m',
  'precipitation',
  'rain',
  'snowfall',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
] as const;

type HourlyVar = (typeof HOURLY_VARS)[number];

interface District {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface WeatherRow {
  district: string;
  date: string;
  time: string;
  datetime: string;
  temperature: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
}

type OpenMeteoHourly = { time: string[] } & Record<HourlyVar, number[]>;

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
}

// ── Districts ─────────────────────────────────────────────────────────────────

const DISTRICTS: District[] = [
  { id: 'melikgazi', name: 'Melikgazi', latitude: 38.7205, longitude: 35.4826 },
  { id: 'talas', name: 'Talas', latitude: 38.6908, longitude: 35.5538 },
  { id: 'kocasinan', name: 'Kocasinan', latitude: 38.7312, longitude: 35.4787 },
];

// ── API ───────────────────────────────────────────────────────────────────────

function buildApiUrl(district: District): string {
  const params = new URLSearchParams({
    latitude: String(district.latitude),
    longitude: String(district.longitude),
    start_date: START_DATE,
    end_date: END_DATE,
    hourly: HOURLY_VARS.join(','),
    timezone: TIMEZONE,
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
}

async function fetchWeatherForDistrict(district: District): Promise<OpenMeteoResponse> {
  const url = buildApiUrl(district);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<OpenMeteoResponse>;
}

// ── Transform ─────────────────────────────────────────────────────────────────

function safeNum(val: number | null | undefined): number {
  return val != null && Number.isFinite(val) ? val : 0;
}

function convertToRows(district: District, data: OpenMeteoResponse): WeatherRow[] {
  const h = data.hourly;
  if (!h || !Array.isArray(h.time)) {
    throw new Error(`"${district.name}": missing hourly.time in API response`);
  }
  for (const v of HOURLY_VARS) {
    if (!Array.isArray(h[v])) {
      throw new Error(`"${district.name}": missing hourly.${v} in API response`);
    }
  }

  return h.time.map((datetime, i) => {
    const sep = datetime.indexOf('T');
    const date = sep >= 0 ? datetime.slice(0, sep) : datetime;
    const time = sep >= 0 ? datetime.slice(sep + 1) : '00:00';
    return {
      district: district.name,
      date,
      time,
      datetime,
      temperature: safeNum(h.temperature_2m[i]),
      precipitation: safeNum(h.precipitation[i]),
      rain: safeNum(h.rain[i]),
      snowfall: safeNum(h.snowfall[i]),
      windSpeed: safeNum(h.wind_speed_10m[i]),
      windGusts: safeNum(h.wind_gusts_10m[i]),
      windDirection: safeNum(h.wind_direction_10m[i]),
    };
  });
}

// ── File writers ──────────────────────────────────────────────────────────────

function writeJson(filePath: string, rows: WeatherRow[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  } catch (e) {
    throw new Error(`Failed to write JSON ${filePath}: ${e}`);
  }
}

const CSV_HEADER =
  'district,date,time,datetime,temperature,precipitation,rain,snowfall,windSpeed,windGusts,windDirection';

function rowToCsvLine(row: WeatherRow): string {
  return [
    row.district,
    row.date,
    row.time,
    row.datetime,
    row.temperature,
    row.precipitation,
    row.rain,
    row.snowfall,
    row.windSpeed,
    row.windGusts,
    row.windDirection,
  ].join(',');
}

function writeCsv(filePath: string, rows: WeatherRow[]): void {
  try {
    const content = [CSV_HEADER, ...rows.map(rowToCsvLine)].join('\n') + '\n';
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    throw new Error(`Failed to write CSV ${filePath}: ${e}`);
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

function districtFilesExist(id: string): boolean {
  return (
    fs.existsSync(path.join(OUT_DIR, `${id}-hourly-weather-2025.json`)) &&
    fs.existsSync(path.join(OUT_DIR, `${id}-hourly-weather-2025.csv`))
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allRows: WeatherRow[] = [];
  let anyFetched = false;

  for (const district of DISTRICTS) {
    const jsonPath = path.join(OUT_DIR, `${district.id}-hourly-weather-2025.json`);
    const csvPath = path.join(OUT_DIR, `${district.id}-hourly-weather-2025.csv`);

    if (!FORCE && districtFilesExist(district.id)) {
      console.log(`[skip]  ${district.name}: files exist (--force to re-download)`);
      const cached = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as WeatherRow[];
      allRows.push(...cached);
      continue;
    }

    process.stdout.write(`[fetch] ${district.name} ... `);
    try {
      const data = await fetchWeatherForDistrict(district);
      const rows = convertToRows(district, data);
      writeJson(jsonPath, rows);
      writeCsv(csvPath, rows);
      allRows.push(...rows);
      anyFetched = true;
      console.log(`${rows.length} rows`);
    } catch (e) {
      console.error(`\n[error] ${district.name}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  const combinedJsonPath = path.join(OUT_DIR, 'kayseri-districts-hourly-weather-2025.json');
  const combinedCsvPath = path.join(OUT_DIR, 'kayseri-districts-hourly-weather-2025.csv');
  const needCombined =
    anyFetched ||
    FORCE ||
    !fs.existsSync(combinedJsonPath) ||
    !fs.existsSync(combinedCsvPath);

  if (needCombined) {
    process.stdout.write('[write] kayseri-districts combined ... ');
    writeJson(combinedJsonPath, allRows);
    writeCsv(combinedCsvPath, allRows);
    console.log(`${allRows.length} rows`);
  } else {
    console.log('[skip]  kayseri-districts combined: files exist (--force to rebuild)');
  }

  const districtCount = DISTRICTS.length;
  const rowsPerDistrict = allRows.length / districtCount;
  console.log(`\nDone.`);
  console.log(`  Districts : ${districtCount}`);
  console.log(`  Rows/dist : ${rowsPerDistrict} (expected 8760 for a full year)`);
  console.log(`  Total rows: ${allRows.length}`);
  console.log(`  Output    : ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
