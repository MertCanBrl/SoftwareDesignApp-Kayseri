/**
 * Reads the Kayseri rail hourly passenger Excel export and writes assets/data/passengerData.json
 * (for tooling/backup) plus per-date shards, passengerDates.json, hourlyStationSummary.json,
 * and src/generated/passengerDataIndex.ts. The app must not import the monolithic file.
 * Expected columns (case-insensitive): TARIH, DURAK_ID, SAAT, YOLCU_SAYISI; DURAK_AD optional (yalnızca ID map'te yoksa yedek)
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { DURAK_ID_CANONICAL_AD, getCanonicalDurakAd } from '../src/constants/durakCanonicalMap';
import { emitPassengerDataArtifacts } from './emitPassengerDataArtifacts';

const PROJECT_ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'data');

const CANDIDATE_EXCEL_PATHS = [
  path.join(PROJECT_ROOT, '..', 'Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx'),
  path.join(PROJECT_ROOT, 'Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx'),
];

function normalizeHeader(h: string | undefined) {
  return String(h ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\u0307/g, '')
    .replace(/I/g, 'I');
}

function findExcelFile() {
  for (const p of CANDIDATE_EXCEL_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function excelSerialToISODate(serial: number) {
  if (typeof serial === 'number' && !Number.isNaN(serial)) {
    const utc = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return null;
}

function parseDateCell(val: unknown) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return excelSerialToISODate(val);
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
}

function parseHour(val: unknown) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return ((val.getHours() % 24) + 24) % 24;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (val >= 0 && val < 1) {
      const h = Math.floor(val * 24 + 1e-9);
      return Math.min(23, Math.max(0, h));
    }
    if (val >= 0 && val <= 23) return Math.floor(val);
    if (val > 23 && val < 24) return Math.floor(val);
    return ((Math.floor(val) % 24) + 24) % 24;
  }
  const s = String(val).trim();
  const num = parseInt(s, 10);
  if (!Number.isNaN(num)) return ((num % 24) + 24) % 24;
  const hm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return Math.min(23, Math.max(0, parseInt(hm[1], 10)));
  return null;
}

function parseIntSafe(val: unknown) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  const n = parseInt(String(val).replace(/\s/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

type Row = Record<string, unknown>;

function resolveColumns(first: Row) {
  const headerMap: Record<string, string> = {};
  for (const key of Object.keys(first)) {
    headerMap[normalizeHeader(key)] = key;
  }
  const col = (aliases: string[]) => {
    for (const a of aliases) {
      const k = headerMap[normalizeHeader(a)];
      if (k) return k;
    }
    return null;
  };
  return {
    kTarih: col(['TARIH', 'TARİH', 'DATE']),
    kDurakId: col(['DURAK_ID', 'DURAKID', 'ISTASYON_ID']),
    kDurakAd: col(['DURAK_AD', 'DURAKAD', 'DURAK_ADI', 'ISTASYON_AD']),
    kSaat: col(['SAAT', 'HOUR']),
    kYolcu: col(['YOLCU_SAYISI', 'YOLCUSAYISI', 'YOLCU', 'PASSENGER']),
  };
}

function processSheetRows(
  rows: Row[],
  cols: {
    kTarih: string;
    kDurakId: string;
    kDurakAd: string | null;
    kSaat: string;
    kYolcu: string;
  }
) {
  const { kTarih, kDurakId, kDurakAd, kSaat, kYolcu } = cols;
  const chunk: {
    tarih: string;
    durakId: string;
    durakAd: string;
    saat: number;
    yolcuSayisi: number;
  }[] = [];
  for (const row of rows) {
    const tarih = parseDateCell(row[kTarih]);
    const saat = parseHour(row[kSaat]);
    const yolcuSayisi = parseIntSafe(row[kYolcu]);
    const durakIdNum = parseIntSafe(row[kDurakId]);
    if (durakIdNum == null) continue;
    const durakId = String(durakIdNum);
    const rawAd =
      kDurakAd && row[kDurakAd] != null && row[kDurakAd] !== ''
        ? String(row[kDurakAd]).trim()
        : '';
    const idKey = Math.round(durakIdNum);
    if (DURAK_ID_CANONICAL_AD[idKey] === undefined) {
      throw new Error(`Unknown DURAK_ID: ${durakIdNum}`);
    }
    const cleanDurakAd = getCanonicalDurakAd(durakIdNum, rawAd);
    if (idKey === 1006003 && cleanDurakAd !== 'Ondokuz Mayıs') {
      throw new Error(`1006003 yanlış dönüştü: ${cleanDurakAd}`);
    }
    if (!tarih || saat == null || yolcuSayisi == null) continue;
    chunk.push({
      tarih,
      durakId,
      durakAd: cleanDurakAd,
      saat,
      yolcuSayisi,
    });
  }
  return chunk;
}

function main() {
  const excelPath = findExcelFile();
  if (!excelPath) {
    console.error(
      'Excel not found. Place "Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx" in the project root or parent folder (Software).'
    );
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelPath, { cellDates: false });
  console.log('workbook.SheetNames:', workbook.SheetNames);

  const out: {
    tarih: string;
    durakId: string;
    durakAd: string;
    saat: number;
    yolcuSayisi: number;
  }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });
    if (!rows.length) {
      console.log(`[skip] "${sheetName}": empty`);
      continue;
    }
    const first = rows[0]!;
    const cols = resolveColumns(first);
    if (!cols.kTarih || !cols.kDurakId || !cols.kSaat || !cols.kYolcu) {
      console.warn(
        `[skip] "${sheetName}": could not map required columns. Headers:`,
        Object.keys(first),
        'mapped:',
        cols
      );
      continue;
    }
    const required = {
      kTarih: cols.kTarih,
      kDurakId: cols.kDurakId,
      kSaat: cols.kSaat,
      kYolcu: cols.kYolcu,
    };
    const chunk = processSheetRows(rows, { ...required, kDurakAd: cols.kDurakAd });
    console.log(`[ok] "${sheetName}": ${chunk.length} rows from sheet_to_json base`);
    out.push(...chunk);
  }

  if (!out.length) {
    console.error('No data from any sheet.');
    process.exit(1);
  }

  const allTarih = out.map((r) => r.tarih);
  const minDate = allTarih.reduce((a, b) => (a < b ? a : b));
  const maxDate = allTarih.reduce((a, b) => (a > b ? a : b));
  const monthSet = new Set(out.map((r) => r.tarih.slice(0, 7)));
  const uniqueMonths = [...monthSet].sort();
  const uniqueDurakIds = new Set(out.map((r) => r.durakId));

  console.log('--- convert summary ---');
  console.log('total rows:', out.length);
  console.log('minDate:', minDate);
  console.log('maxDate:', maxDate);
  console.log('unique months:', uniqueMonths);
  console.log('unique durakId count:', uniqueDurakIds.size);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { dates, byDateCount } = emitPassengerDataArtifacts(out, PROJECT_ROOT);
  console.log(
    `Wrote shards: ${byDateCount} day files, passengerDates (${dates.length} entries), hourlyStationSummary.json, index`
  );
}

main();
