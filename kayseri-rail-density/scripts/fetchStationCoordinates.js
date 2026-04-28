/**
 * DURAK_ID + kanonik isimlere göre (passenger ismi değil) Nominatim ile koordinat üretir.
 * assets/data/stations.json: { durakId, name, lat, lng } — mevcut lat/lng doluysa atlanır.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const CANONICAL_TS = path.join(PROJECT_ROOT, 'src', 'constants', 'durakCanonicalMap.ts');
const STATIONS_OUT = path.join(PROJECT_ROOT, 'assets', 'data', 'stations.json');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const MISSING_OUT = path.join(LOGS_DIR, 'missingStations.json');

const DELAY_MS = 1000;
const USER_AGENT = 'KayseriRailDensityApp/1.0 (academic project; contact: local-dev)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCanonicalMap() {
  const src = fs.readFileSync(CANONICAL_TS, 'utf8');
  const map = {};
  for (const m of src.matchAll(/(\d+):\s*'((?:\\'|[^'])*)'/g)) {
    map[m[1]] = m[2].replace(/\\'/g, "'");
  }
  const keys = Object.keys(map).sort((a, b) => Number(a) - Number(b));
  if (keys.length < 1) {
    throw new Error(`No entries parsed from ${CANONICAL_TS}`);
  }
  return { map, keys };
}

function loadStationsById() {
  if (!fs.existsSync(STATIONS_OUT)) return new Map();
  try {
    const list = JSON.parse(fs.readFileSync(STATIONS_OUT, 'utf8'));
    return new Map(list.map((s) => [String(s.durakId), s]));
  } catch {
    return new Map();
  }
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

const VIEWBOX = '35.38,38.66,35.58,38.82';

async function nominatimSearch(canonicalName) {
  const attempts = [
    { q: `${canonicalName} Kayseri tramvay`, viewbox: VIEWBOX, bounded: '1' },
    { q: `${canonicalName} tramvay durağı Kayseri`, viewbox: VIEWBOX, bounded: '1' },
    { q: `${canonicalName}, Kayseri, Türkiye` },
    { q: `${canonicalName}, Kayseri, Turkey` },
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

function hasCoords(rec) {
  if (!rec) return false;
  const la = rec.lat != null ? rec.lat : rec.latitude;
  const ln = rec.lng != null ? rec.lng : rec.longitude;
  return la != null && ln != null && !Number.isNaN(+la) && !Number.isNaN(+ln);
}

async function main() {
  const { map, keys } = loadCanonicalMap();
  const existingById = loadStationsById();
  const missing = [];
  const total = keys.length;

  for (let i = 0; i < keys.length; i += 1) {
    const durakId = keys[i];
    const name = map[durakId];
    const prev = existingById.get(durakId);
    if (hasCoords(prev)) {
      const lat = prev.lat != null ? prev.lat : prev.latitude;
      const lng = prev.lng != null ? prev.lng : prev.longitude;
      const rec = { durakId, name, lat, lng };
      existingById.set(durakId, rec);
      console.log(`[${i + 1}/${total}] id=${durakId} ${name} ... cached`);
      continue;
    }
    process.stdout.write(`[${i + 1}/${total}] id=${durakId} ${name} ... `);
    try {
      const coords = await nominatimSearch(name);
      if (coords) {
        const rec = { durakId, name, lat: coords.latitude, lng: coords.longitude };
        existingById.set(durakId, rec);
        console.log('ok');
      } else {
        const rec = { durakId, name, lat: null, lng: null };
        existingById.set(durakId, rec);
        missing.push({ durakId, name, reason: 'no_results' });
        console.log('not found (lat/lng null)');
      }
    } catch (e) {
      const rec = { durakId, name, lat: null, lng: null };
      existingById.set(durakId, rec);
      missing.push({
        durakId,
        name,
        reason: String(e && e.message ? e.message : e),
      });
      console.log('error', e.message || e);
    }
    await sleep(DELAY_MS);
  }

  const ordered = keys.map((id) => existingById.get(id)).filter(Boolean);

  fs.mkdirSync(path.dirname(STATIONS_OUT), { recursive: true });
  fs.writeFileSync(STATIONS_OUT, JSON.stringify(ordered, null, 2), 'utf8');
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(MISSING_OUT, JSON.stringify(missing, null, 2), 'utf8');

  console.log(`\nSaved ${ordered.length} stations to ${STATIONS_OUT}`);
  console.log(`Missing / failed geocode: ${missing.length} (see ${MISSING_OUT})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
