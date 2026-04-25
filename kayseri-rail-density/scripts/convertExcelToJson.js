/**
 * Reads the Kayseri rail hourly passenger Excel export and writes assets/data/passengerData.json
 * Expected columns (case-insensitive): TARIH, DURAK_ID, DURAK_AD, SAAT, YOLCU_SAYISI
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'data');
const OUT_FILE = path.join(OUT_DIR, 'passengerData.json');

const CANDIDATE_EXCEL_PATHS = [
  path.join(PROJECT_ROOT, '..', 'Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx'),
  path.join(PROJECT_ROOT, 'Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx'),
];

function normalizeHeader(h) {
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

function excelSerialToISODate(serial) {
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

function parseDateCell(val) {
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

function parseHour(val) {
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

function parseIntSafe(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  const n = parseInt(String(val).replace(/\s/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function main() {
  const excelPath = findExcelFile();
  if (!excelPath) {
    console.error(
      'Excel not found. Place "Raylı Sistem 2025 Saat Bazlı Yolcu Sayısı.xlsx" in the project root or parent folder (Software).'
    );
    process.exit(1);
  }

  // Keep numeric Excel serials for dates/times; cellDates would turn SAAT into Date and break parsing
  const workbook = XLSX.readFile(excelPath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

  if (!rows.length) {
    console.error('Sheet is empty.');
    process.exit(1);
  }

  const first = rows[0];
  const headerMap = {};
  for (const key of Object.keys(first)) {
    headerMap[normalizeHeader(key)] = key;
  }

  const col = (aliases) => {
    for (const a of aliases) {
      const k = headerMap[normalizeHeader(a)];
      if (k) return k;
    }
    return null;
  };

  const kTarih = col(['TARIH', 'TARİH', 'DATE']);
  const kDurakId = col(['DURAK_ID', 'DURAKID', 'ISTASYON_ID']);
  const kDurakAd = col(['DURAK_AD', 'DURAKAD', 'DURAK_ADI', 'ISTASYON_AD']);
  const kSaat = col(['SAAT', 'HOUR']);
  const kYolcu = col(['YOLCU_SAYISI', 'YOLCUSAYISI', 'YOLCU', 'PASSENGER']);

  if (!kTarih || !kDurakId || !kDurakAd || !kSaat || !kYolcu) {
    console.error('Could not map columns. Found headers:', Object.keys(first));
    console.error('Mapped:', { kTarih, kDurakId, kDurakAd, kSaat, kYolcu });
    process.exit(1);
  }

  const out = [];
  for (const row of rows) {
    const tarih = parseDateCell(row[kTarih]);
    const saat = parseHour(row[kSaat]);
    const yolcuSayisi = parseIntSafe(row[kYolcu]);
    const durakId = row[kDurakId] != null ? String(row[kDurakId]).trim() : '';
    const durakAd = row[kDurakAd] != null ? String(row[kDurakAd]).trim() : '';

    if (!tarih || saat == null || yolcuSayisi == null || !durakId || !durakAd) continue;

    out.push({
      tarih,
      durakId,
      durakAd,
      saat,
      yolcuSayisi,
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} rows to ${OUT_FILE}`);
}

main();
