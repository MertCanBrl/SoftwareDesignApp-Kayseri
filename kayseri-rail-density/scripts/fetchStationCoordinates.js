/**
 * Reads assets/data/passengerData.json, geocodes unique station names via OSM Nominatim,
 * writes assets/data/stations.json and logs/missingStations.json for failures.
 *
 * Nominatim usage policy: max 1 req/s, identify with User-Agent.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PASSENGER_FILE = path.join(PROJECT_ROOT, 'assets', 'data', 'passengerData.json');
const STATIONS_OUT = path.join(PROJECT_ROOT, 'assets', 'data', 'stations.json');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const MISSING_OUT = path.join(LOGS_DIR, 'missingStations.json');

const DELAY_MS = 1000;
const USER_AGENT = 'KayseriRailDensityApp/1.0 (academic project; contact: local-dev)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadPassengerRows() {
  const raw = fs.readFileSync(PASSENGER_FILE, 'utf8');
  return JSON.parse(raw);
}

function uniqueStationsByName(rows) {
  const byName = new Map();
  for (const r of rows) {
    const name = (r.durakAd || '').trim();
    if (!name) continue;
    if (!byName.has(name)) {
      byName.set(name, { durakId: String(r.durakId), durakAd: name });
    }
  }
  return [...byName.values()];
}

async function nominatimRequest(params) {
  const qs = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'tr',
    ...params,
  });
  const url = `https://nominatim.openstreetmap.org/search?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Kayseri merkez civarı — sonuçları şehre yakınsın diye viewbox ile öncelikle */
const VIEWBOX = '35.38,38.66,35.58,38.82';

async function nominatimSearch(durakAd) {
  const attempts = [
    { q: `${durakAd} Kayseri tramvay`, viewbox: VIEWBOX, bounded: '1' },
    { q: `${durakAd} tramvay durağı Kayseri`, viewbox: VIEWBOX, bounded: '1' },
    { q: `${durakAd}, Kayseri, Türkiye` },
    { q: `${durakAd}, Kayseri, Turkey` },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    if (i > 0) await sleep(DELAY_MS);
    const data = await nominatimRequest(attempts[i]);
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return { latitude: lat, longitude: lon, displayName: first.display_name };
      }
    }
  }
  return null;
}

function loadExistingStations() {
  if (!fs.existsSync(STATIONS_OUT)) return new Map();
  try {
    const list = JSON.parse(fs.readFileSync(STATIONS_OUT, 'utf8'));
    const m = new Map();
    for (const s of list) {
      m.set(String(s.durakId), s);
    }
    return m;
  } catch {
    return new Map();
  }
}

async function main() {
  if (!fs.existsSync(PASSENGER_FILE)) {
    console.error('Missing', PASSENGER_FILE, '— run npm run convert-excel first.');
    process.exit(1);
  }

  const rows = loadPassengerRows();
  const stations = uniqueStationsByName(rows);
  const existingById = loadExistingStations();
  const found = [...existingById.values()];
  const missing = [];

  for (let i = 0; i < stations.length; i += 1) {
    const s = stations[i];
    if (existingById.has(String(s.durakId))) {
      console.log(`[${i + 1}/${stations.length}] ${s.durakAd} ... cached`);
      continue;
    }
    process.stdout.write(`[${i + 1}/${stations.length}] ${s.durakAd} ... `);
    try {
      const coords = await nominatimSearch(s.durakAd);
      if (coords) {
        const rec = {
          durakId: s.durakId,
          durakAd: s.durakAd,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        found.push(rec);
        existingById.set(String(s.durakId), rec);
        console.log('ok');
      } else {
        missing.push({ durakId: s.durakId, durakAd: s.durakAd, reason: 'no_results' });
        console.log('not found');
      }
    } catch (e) {
      missing.push({
        durakId: s.durakId,
        durakAd: s.durakAd,
        reason: String(e && e.message ? e.message : e),
      });
      console.log('error', e.message || e);
    }
    await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(STATIONS_OUT), { recursive: true });
  fs.writeFileSync(STATIONS_OUT, JSON.stringify(found, null, 2), 'utf8');
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(MISSING_OUT, JSON.stringify(missing, null, 2), 'utf8');

  console.log(`\nSaved ${found.length} stations to ${STATIONS_OUT}`);
  console.log(`Missing: ${missing.length} (see ${MISSING_OUT})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
