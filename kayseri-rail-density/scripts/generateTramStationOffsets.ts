/**
 * generateTramStationOffsets.ts
 *
 * Tramvay durakları için terminal kalkışından itibaren tahmini offset (dakika)
 * değerlerini hesaplar ve assets/data/tram-station-offsets.json dosyasını üretir.
 *
 * KULLANIM (proje kökünden):
 *   npx ts-node scripts/generateTramStationOffsets.ts
 *
 * KALİBRASYON:
 * officialDurationMinutes değeri belirtilen hatlar için scaleFactor uygulanır:
 *   scaleFactor = officialDurationMinutes / haversineRawDuration
 *   offsetMinutes = Math.round(rawOffsetMinutes * scaleFactor)
 *
 * Resmi süreler — Kayseri Ulaşım / Kayseri Büyükşehir Belediyesi:
 *   T1: 70 dk (Organize Sanayi → İldem 5, 27 km) — güvenilir
 *   T2: 33 dk (Cumhuriyet Meydanı → Talas Cemil Baba, 10 km) — güvenilir
 *   T3: 78 dk (Kumsmall AVM → İldem 5) — doğrulandı
 *   T4: resmi süre doğrulanamadı (10 km uzunluk mevcut, süre kesin değil)
 *
 * NOT: Bu script gerçek zamanlı GPS verisi kullanmaz.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Haversine mesafe hesabı (metre)
// ---------------------------------------------------------------------------
const EARTH_R_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_R_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function metersToMinutes(meters: number, kmh: number): number {
  return meters / ((kmh * 1000) / 60);
}

// ---------------------------------------------------------------------------
// Veri tipleri
// ---------------------------------------------------------------------------
type StationJson = { durakId: string; name: string; lat: number; lng: number };

type StationOffset = { name: string; offsetMinutes: number };

type DirectionMeta = {
  /** Kayseri Ulaşım resmi toplam sefer süresi (varsa). */
  officialDurationMinutes: number | null;
  /** Ham haversine hesabından çıkan toplam süre (yuvarlama öncesi). */
  generatedDurationBeforeScaling: number;
  /** Uygulanan ölçek faktörü. officialDurationMinutes yoksa 1.0. */
  scaleFactor: number;
  /** Offset güven seviyesi. */
  confidence: 'high' | 'medium' | 'low';
  /** Hangi yöntemin kullanıldığını açıklar. */
  source: 'haversine_distance_scaled_to_official_duration' | 'haversine_distance_unscaled';
};

type DirectionData = {
  terminalStationId: string;
  terminalStationName: string;
  meta: DirectionMeta;
  /** Terminal kalkışından itibaren geçilen durak sırası (doğru monoton sıra için gerekli). */
  orderedStationIds: string[];
  stations: Record<string, StationOffset>;
};

type OffsetOutput = {
  version: string;
  generatedAt: string;
  note: string;
  averageSpeedKmh: number;
  routes: Record<string, { gidis: DirectionData; donus: DirectionData }>;
};

// ---------------------------------------------------------------------------
// Resmi sefer süresi referansları
//
// Kaynak: Kayseri Ulaşım raylı sistem / Kayseri Büyükşehir Belediyesi
// T1: 70 dk (Organize Sanayi → İldem 5)
// T2: 33 dk (Cumhuriyet Meydanı → Talas Cemil Baba)
// T3: 78 dk (Kumsmall AVM → İldem 5) — doğrulandı
// T4: 38 dk (Cumhuriyet Meydanı → İzzet Bayraktar Camii) — rapor 35–40 dk aralığı, orta değer 38 dk kullanıldı
//
// Gidiş ve dönüş süreleri eşit kabul edilmiştir (simetrik hat).
// ---------------------------------------------------------------------------
const OFFICIAL_DURATIONS: Record<string, number | null> = {
  T1: 70,
  T2: 33,
  T3: 78,
  T4: 38,
};

// ---------------------------------------------------------------------------
// Hat rota tanımları
// ---------------------------------------------------------------------------
function makeRange(from: number, to: number): string[] {
  const step = from <= to ? 1 : -1;
  const result: string[] = [];
  for (let i = from; i !== to + step; i += step) {
    result.push(String(i));
  }
  return result;
}

type RouteConfig = {
  lineId: string;
  direction: 'gidis' | 'donus';
  terminalStationId: string;
  orderedStationIds: string[];
};

const ROUTE_CONFIGS: RouteConfig[] = [
  // T1 gidis: Organize Sanayi (1006001) → İldem 5 (1006043) — 43 durak, 27 km
  {
    lineId: 'T1',
    direction: 'gidis',
    terminalStationId: '1006001',
    orderedStationIds: makeRange(1006001, 1006043),
  },
  // T1 donus: İldem 5 → Organize Sanayi
  {
    lineId: 'T1',
    direction: 'donus',
    terminalStationId: '1006043',
    orderedStationIds: makeRange(1006043, 1006001),
  },
  // T2 gidis: Cumhuriyet Meydanı (1006019) → Talas Cemil Baba (1006055) — 10 km
  {
    lineId: 'T2',
    direction: 'gidis',
    terminalStationId: '1006019',
    orderedStationIds: ['1006019', ...makeRange(1006044, 1006055)],
  },
  // T2 donus: Talas Cemil Baba → Cumhuriyet Meydanı
  {
    lineId: 'T2',
    direction: 'donus',
    terminalStationId: '1006055',
    orderedStationIds: [...makeRange(1006055, 1006044), '1006019'],
  },
  // T3 gidis: Kumsmall AVM (1006066) → hastane kolu (ID azalıyor) → T1 ana koridor → İldem 5
  // Hastane kolu: 1006066→1006056 (coğrafi kuzeyden güneye)
  // T1 ana koridoru: 1006006→1006043 (batıdan doğuya)
  {
    lineId: 'T3',
    direction: 'gidis',
    terminalStationId: '1006066',
    orderedStationIds: [
      ...makeRange(1006066, 1006056), // hastane kolu
      ...makeRange(1006006, 1006043), // T1 ana koridor
    ],
  },
  // T3 donus: İldem 5 → T1 ana koridor → hastane kolu → Kumsmall AVM
  {
    lineId: 'T3',
    direction: 'donus',
    terminalStationId: '1006043',
    orderedStationIds: [
      ...makeRange(1006043, 1006006), // T1 ana koridor
      ...makeRange(1006056, 1006066), // hastane kolu
    ],
  },
  // T4 gidis: Cumhuriyet Meydanı (1006019) → İzzet Bayraktar Camii (1006075) — 16 durak, ~12 km
  // Resmi süre: rapor 35–40 dk aralığı; orta değer 38 dk kullanılmıştır.
  {
    lineId: 'T4',
    direction: 'gidis',
    terminalStationId: '1006019',
    orderedStationIds: [
      '1006019', '1006020', '1006021', '1006022', // Cumhuriyet → Hunat → Büyükşehir → Fuzuli
      '1006044', '1006045', '1006046',             // Sema Yazar → Şehit Mustafa → Şehit Furkan
      '1006067', '1006068', '1006069', '1006070',  // Yıldırım Beyazıt → Keçitepesi → Dedeman → Germiraltı
      '1006071', '1006072', '1006073', '1006074', '1006075', // Kayseri Ü. → Halef Hoca → Anayurt → Turgut Özal → İzzet Bayraktar
    ],
  },
  // T4 donus: İzzet Bayraktar Camii → Cumhuriyet Meydanı (gidiş tersine)
  {
    lineId: 'T4',
    direction: 'donus',
    terminalStationId: '1006075',
    orderedStationIds: [
      '1006075', '1006074', '1006073', '1006072', '1006071',
      '1006070', '1006069', '1006068', '1006067',
      '1006046', '1006045', '1006044',
      '1006022', '1006021', '1006020', '1006019',
    ],
  },
];

// ---------------------------------------------------------------------------
// Hesaplama
// ---------------------------------------------------------------------------
const AVG_KMH = 22;

function resolveConfidence(lineId: string, officialDuration: number | null): 'high' | 'medium' | 'low' {
  if (officialDuration !== null) {
    // Resmi süre ile kalibre edilmiş → yüksek güven
    return 'high';
  }
  // Resmi süre yok; T3 uzun ama koordinat kapsama makul, T4 ara durak eksik
  if (lineId === 'T3') return 'medium';
  return 'low'; // T4: ara durak eksikliği var
}

type RawPassResult = {
  stations: Record<string, { name: string; rawMin: number }>;
  rawTotalMin: number;
};

function computeRaw(
  config: RouteConfig,
  coordsById: Map<string, { lat: number; lng: number; name: string }>,
): RawPassResult {
  const stations: Record<string, { name: string; rawMin: number }> = {};
  let cumMin = 0;

  for (let i = 0; i < config.orderedStationIds.length; i++) {
    const id = config.orderedStationIds[i];
    const info = coordsById.get(id);

    if (i > 0) {
      const prev = coordsById.get(config.orderedStationIds[i - 1]);
      const curr = info;
      if (prev && curr) {
        cumMin += metersToMinutes(haversineMeters(prev, curr), AVG_KMH);
      }
    }

    stations[id] = { name: info?.name ?? id, rawMin: cumMin };
  }

  return { stations, rawTotalMin: cumMin };
}

function buildDirectionData(
  config: RouteConfig,
  coordsById: Map<string, { lat: number; lng: number; name: string }>,
): DirectionData {
  const terminalInfo = coordsById.get(config.terminalStationId);
  const officialDuration = OFFICIAL_DURATIONS[config.lineId] ?? null;

  const { stations: rawStations, rawTotalMin } = computeRaw(config, coordsById);

  const scaleFactor = officialDuration !== null ? officialDuration / rawTotalMin : 1.0;

  const stations: Record<string, StationOffset> = {};
  // orderedStationIds kullanarak monoton sırada işle (Object.keys numerik sort yapar — KULLANMA)
  let prevOffset = -1;
  for (const id of config.orderedStationIds) {
    const { name, rawMin } = rawStations[id];
    let off = Math.round(rawMin * scaleFactor);
    // Yuvarlama kaynaklı plato veya düşüşü engelle
    if (off <= prevOffset) off = prevOffset + 1;
    stations[id] = { name, offsetMinutes: off };
    prevOffset = off;
  }

  const meta: DirectionMeta = {
    officialDurationMinutes: officialDuration,
    generatedDurationBeforeScaling: Math.round(rawTotalMin * 10) / 10,
    scaleFactor: Math.round(scaleFactor * 10000) / 10000,
    confidence: resolveConfidence(config.lineId, officialDuration),
    source:
      officialDuration !== null
        ? 'haversine_distance_scaled_to_official_duration'
        : 'haversine_distance_unscaled',
  };

  return {
    terminalStationId: config.terminalStationId,
    terminalStationName: terminalInfo?.name ?? config.terminalStationId,
    meta,
    orderedStationIds: config.orderedStationIds,
    stations,
  };
}

// ---------------------------------------------------------------------------
// Giriş noktası
// ---------------------------------------------------------------------------
function main(): void {
  const projectRoot = path.resolve(__dirname, '..');
  const stationsPath = path.join(projectRoot, 'assets', 'data', 'stations.json');
  const outputPath = path.join(projectRoot, 'assets', 'data', 'tram-station-offsets.json');

  const rawStations: StationJson[] = JSON.parse(fs.readFileSync(stationsPath, 'utf-8'));
  const coordsById = new Map(
    rawStations.map((s) => [s.durakId, { lat: s.lat, lng: s.lng, name: s.name }]),
  );

  const routes: OffsetOutput['routes'] = {} as OffsetOutput['routes'];

  for (const config of ROUTE_CONFIGS) {
    if (!routes[config.lineId]) {
      routes[config.lineId] = {} as { gidis: DirectionData; donus: DirectionData };
    }
    routes[config.lineId][config.direction] = buildDirectionData(config, coordsById);
  }

  const output: OffsetOutput = {
    version: '1.1',
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      'TAHMİNİ offset değerleri — gerçek zamanlı GPS verisi değil. ' +
      'T1, T2 ve T3 resmi Kayseri Ulaşım sefer süreleriyle, T4 rapor kaynaklı orta değer (38 dk) ile kalibre edilmiştir. ' +
      'Gerçek geçiş saatleriyle ±2-5 dakika sapma olabilir.',
    averageSpeedKmh: AVG_KMH,
    routes,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✓ ${outputPath} yazıldı.\n`);

  // Konsol rapor
  console.log('Hat       Yön    Resmi   Ham     Scale   Son offset  Güven');
  console.log('─'.repeat(62));
  for (const [lineId, dirs] of Object.entries(routes)) {
    for (const [dir, data] of Object.entries(dirs) as [string, DirectionData][]) {
      const ids = Object.keys(data.stations);
      const last = data.stations[ids[ids.length - 1]]?.offsetMinutes ?? 0;
      const m = data.meta;
      const official = m.officialDurationMinutes !== null ? `${m.officialDurationMinutes}dk` : '-';
      const raw = `${m.generatedDurationBeforeScaling}dk`;
      const sf = m.scaleFactor.toFixed(4);
      console.log(
        `${lineId.padEnd(9)} ${dir.padEnd(6)} ${official.padEnd(7)} ${raw.padEnd(7)} ${sf.padEnd(7)} ${String(last).padEnd(11)}dk  ${m.confidence}`,
      );
    }
  }
}

main();
