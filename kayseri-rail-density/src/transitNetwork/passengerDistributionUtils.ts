/**
 * passengerDistributionUtils.ts
 *
 * Saatlik toplam yolcu sayısını o saat dilimindeki tahmini geçişlere dağıtır.
 *
 * ÖNEMLİ: Bu modül gerçek zamanlı veri kullanmaz.
 * Sonuçlar "saatlik toplam / geçiş sayısı" eşit dağıtımıyla üretilir.
 * Bireysel geçiş başına yolcu sayıları tahminidir; gerçek doluluktan bağımsızdır.
 */

import type { EstimatedStationPassage } from './stationPassageUtils';

// ---------------------------------------------------------------------------
// Çıktı tipi
// ---------------------------------------------------------------------------

export type PassagePassengerDistribution = {
  /** Tahmini geçiş saati (HH:MM). */
  estimatedPassageTime: string;
  /** Hat ID'si (örn. "T1", "T2"). */
  lineId: string;
  /** Seyahat yönü ("gidis" | "donus"). */
  direction: string;
  /** Bu geçişe atanan tahmini yolcu sayısı. */
  estimatedPassengers: number;
  /** Rota kalibrasyon güven seviyesi (kaynak: tram-station-offsets.json meta.confidence). */
  confidence: 'low' | 'medium' | 'high';
  /** Dağıtım yöntemini açıklayan not. */
  explanation: string;
};

// ---------------------------------------------------------------------------
// Sabit açıklama metni
// ---------------------------------------------------------------------------

const EXPLANATION =
  'Saatlik yolcu tahmini, bu saat dilimindeki tahmini geçişlere eşit dağıtılmıştır.';

// ---------------------------------------------------------------------------
// Dışa açık API
// ---------------------------------------------------------------------------

export type DistributeHourlyPassengersParams = {
  /** Bir saatlik toplam yolcu sayısı (0 veya negatifse tüm geçişlere 0 atanır). */
  hourlyPassengerCount: number;
  /** O saat dilimine ait tahmini geçiş listesi (getEstimatedStationPassages çıktısı). */
  passages: EstimatedStationPassage[];
};

/**
 * Saatlik toplam yolcu sayısını tahmini geçişlere eşit olarak dağıtır.
 *
 * - Geçiş yoksa boş array döner.
 * - hourlyPassengerCount <= 0 ise tüm geçişlere 0 atanır.
 * - Toplam her koşulda korunur: sum(estimatedPassengers) === hourlyPassengerCount.
 * - Yuvarlama farkı son geçişe eklenerek toplam garanti edilir.
 */
export function distributeHourlyPassengersToPassages(
  params: DistributeHourlyPassengersParams,
): PassagePassengerDistribution[] {
  const { hourlyPassengerCount, passages } = params;

  if (passages.length === 0) return [];

  const n = passages.length;

  if (hourlyPassengerCount <= 0) {
    return passages.map((p) => ({
      estimatedPassageTime: p.estimatedPassageTime,
      lineId: p.lineId,
      direction: p.direction,
      estimatedPassengers: 0,
      confidence: p.confidence,
      explanation: EXPLANATION,
    }));
  }

  // Eşit taban pay + yuvarlama farkını son elemana ekle
  const base = Math.floor(hourlyPassengerCount / n);
  const remainder = hourlyPassengerCount - base * n;

  return passages.map((p, i) => ({
    estimatedPassageTime: p.estimatedPassageTime,
    lineId: p.lineId,
    direction: p.direction,
    estimatedPassengers: i === n - 1 ? base + remainder : base,
    confidence: p.confidence,
    explanation: EXPLANATION,
  }));
}
