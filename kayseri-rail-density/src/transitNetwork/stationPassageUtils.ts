/**
 * stationPassageUtils.ts
 *
 * Sefer çizelgesine göre tahmini durak geçiş saatlerini hesaplar.
 *
 * ÖNEMLİ: Bu modül gerçek zamanlı veri kullanmaz.
 * Sonuçlar "sefer çizelgesi + tahmini offset" yöntemiyle üretilir;
 * gerçek araç konumundan bağımsızdır.
 * Geçiş saatlerinde ±2-5 dakika sapma olabilir.
 *
 * confidence alanı offset kalibrasyon güvenini yansıtır:
 *   high   → resmi Kayseri Ulaşım süresiyle kalibre edilmiş
 *            (T1: 70 dk, T2: 33 dk, T3: 78 dk, T4: 38 dk — tüm hatlar high)
 */

import scheduleData from '../../assets/data/tram-schedules.json';
import offsetData from '../../assets/data/tram-station-offsets.json';
import type { TramDayType, TramDirection, TramLine } from './tramScheduleTypes';
import { getDayType } from './tramScheduleUtils';

// ---------------------------------------------------------------------------
// Çıktı tipi
// ---------------------------------------------------------------------------

export type EstimatedStationPassage = {
  /** Durağın ID'si (durakId). */
  stationId: string;
  /** Hattın ID'si (örn. "T1", "T2"). */
  lineId: string;
  /** Seyahat yönü. */
  direction: TramDirection;
  /** Terminal kalkış saati (HH:MM). */
  terminalDepartureTime: string;
  /** Bu durağa tahmini varış saati (HH:MM). */
  estimatedPassageTime: string;
  /** Terminal kalkışından bu durağa tahmini süre (dakika). */
  offsetMinutes: number;
  /**
   * Offset kalibrasyon güven seviyesi (tram-station-offsets.json meta.confidence).
   * - high → resmi Kayseri Ulaşım süresiyle kalibre edilmiş.
   *          T1/T2/T3/T4 hatlarının tamamı high confidence durumundadır.
   */
  confidence: 'low' | 'medium' | 'high';
  /** Bu verinin kaynağını açıklar. */
  source: 'schedule_plus_estimated_offset';
};

// ---------------------------------------------------------------------------
// Dahili yardımcılar
// ---------------------------------------------------------------------------

type OffsetRouteMeta = {
  officialDurationMinutes: number | null;
  generatedDurationBeforeScaling: number;
  scaleFactor: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'haversine_distance_scaled_to_official_duration' | 'haversine_distance_unscaled';
};

type OffsetRouteData = {
  terminalStationId: string;
  terminalStationName: string;
  meta: OffsetRouteMeta;
  orderedStationIds: string[];
  stations: Record<string, { name: string; offsetMinutes: number }>;
};

type OffsetRoutes = Record<string, { gidis: OffsetRouteData; donus: OffsetRouteData }>;

const offsets = (offsetData as { routes: OffsetRoutes }).routes;
const scheduleLines = scheduleData.lines as unknown as Record<string, TramLine>;

/** "HH:MM" + dakika → yeni "HH:MM" (gece yarısı aşımı yok sayılır). */
function addMinutes(hhmm: string, minutesToAdd: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const totalMin = h * 60 + m + minutesToAdd;
  const rh = Math.floor(totalMin / 60) % 24;
  const rm = totalMin % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

/** "HH:MM" → toplam dakika (filtreleme için). */
function toTotalMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Belirli hat/yön/durak üçlüsü için çizelgedeki kalkış saatlerini kullanarak
 * tahmini geçiş saatlerini üretir.
 * Yalnızca seçilen saat dilimine düşen geçişleri döndürür.
 */
function computePassagesForLineDirection(params: {
  lineId: string;
  direction: TramDirection;
  stationId: string;
  dayType: TramDayType;
  hour: number;
}): EstimatedStationPassage[] {
  const { lineId, direction, stationId, dayType, hour } = params;

  const routeData = offsets[lineId]?.[direction];
  if (!routeData) return [];

  const stationOffset = routeData.stations[stationId];
  if (!stationOffset) return [];

  const line = scheduleLines[lineId];
  if (!line) return [];

  const departure = line.departures.find((d) => d.direction === direction);
  if (!departure) return [];

  const terminalTimes = departure.schedule[dayType];
  // Offset kalibrasyon güveni (meta.confidence): T1/T2/T3/T4 hatlarının tamamı high.
  const routeConfidence = routeData.meta.confidence;

  const passages: EstimatedStationPassage[] = [];

  for (const terminalTime of terminalTimes) {
    const estimatedPassageTime = addMinutes(terminalTime, stationOffset.offsetMinutes);
    const passageHour = Math.floor(toTotalMinutes(estimatedPassageTime) / 60) % 24;

    if (passageHour !== hour) continue;

    passages.push({
      stationId,
      lineId,
      direction,
      terminalDepartureTime: terminalTime,
      estimatedPassageTime,
      offsetMinutes: stationOffset.offsetMinutes,
      confidence: routeConfidence,
      source: 'schedule_plus_estimated_offset',
    });
  }

  return passages;
}

// ---------------------------------------------------------------------------
// Dışa açık API
// ---------------------------------------------------------------------------

export type GetEstimatedStationPassagesParams = {
  /** Durak ID'si (stations.json'daki durakId). */
  stationId: string;
  /** Seçilen tarih (gün tipi — hafta içi/cumartesi/pazar — için kullanılır). */
  date: Date;
  /** Sonuçların filtreleneceği saat (0-23). */
  hour: number;
};

/**
 * Belirli bir durak, tarih ve saat için tahmini tramvay geçişlerini döndürür.
 *
 * - Durağa hizmet veren tüm hat/yön kombinasyonlarını tarar.
 * - Her hat için terminal kalkış saatlerine offsetMinutes ekleyerek tahmini geçiş saatini hesaplar.
 * - Yalnızca seçilen `hour` içine düşen geçişleri döndürür.
 * - Çok hatlı duraklarda tüm hat geçişleri birleştirilir ve zamana göre sıralanır.
 *
 * NOT: Sonuçlar tahminidir; gerçek zamanlı araç konumu yansıtmaz.
 */
export function getEstimatedStationPassages(
  params: GetEstimatedStationPassagesParams,
): EstimatedStationPassage[] {
  const { stationId, date, hour } = params;
  const dayType = getDayType(date);
  const lineIds = Object.keys(scheduleLines) as string[];
  const directions: TramDirection[] = ['gidis', 'donus'];

  const all: EstimatedStationPassage[] = [];

  for (const lineId of lineIds) {
    for (const direction of directions) {
      all.push(
        ...computePassagesForLineDirection({ lineId, direction, stationId, dayType, hour }),
      );
    }
  }

  return all.sort(
    (a, b) => toTotalMinutes(a.estimatedPassageTime) - toTotalMinutes(b.estimatedPassageTime),
  );
}

/**
 * Bir durağın hangi hat/yön kombinasyonlarında yer aldığını döndürür.
 * UI bağlantısına gerek kalmadan durak kapsama kontrolü için kullanılabilir.
 */
export type StationLineCoverage = {
  lineId: string;
  direction: TramDirection;
  offsetMinutes: number;
  terminalStationName: string;
  /** Offset hesabının güven seviyesi (meta.confidence). */
  confidence: 'high' | 'medium' | 'low';
};

export function getStationLineCoverage(stationId: string): StationLineCoverage[] {
  const coverage: StationLineCoverage[] = [];
  const lineIds = Object.keys(offsets);
  const directions: TramDirection[] = ['gidis', 'donus'];

  for (const lineId of lineIds) {
    for (const direction of directions) {
      const routeData = offsets[lineId]?.[direction];
      if (!routeData) continue;
      const stationOffset = routeData.stations[stationId];
      if (!stationOffset) continue;
      coverage.push({
        lineId,
        direction,
        offsetMinutes: stationOffset.offsetMinutes,
        terminalStationName: routeData.terminalStationName,
        confidence: routeData.meta.confidence,
      });
    }
  }

  return coverage;
}
