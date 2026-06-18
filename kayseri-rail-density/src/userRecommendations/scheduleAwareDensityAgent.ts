import type { PassagePassengerDistribution } from '../transitNetwork/passengerDistributionUtils';

export type ScheduleAwareDensityResult = {
  /** Bu saat dilimindeki tahmini geçiş sayısı */
  passageCount: number;
  /** Birden fazla hat (T1+T2 gibi) var mı? */
  hasMultipleLines: boolean;
  /**
   * En erken tahmini geçiş saati ("HH:MM").
   * Geçişler passengerDistributionUtils'tan zamana göre sıralı gelir.
   */
  earliestPassageTime: string | null;
  /** En geç tahmini geçiş saati ("HH:MM") */
  latestPassageTime: string | null;
  /**
   * Tüm geçişler içindeki en düşük (worst) rota kalibrasyon güveni.
   * StationDetailScreen'de zaten confidence=high filtrelemesi yapılıyor;
   * bu değer ek bir kontrol katmanıdır.
   */
  scheduleConfidenceLevel: 'high' | 'medium' | 'low';
};

const CONFIDENCE_ORDER: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function lowerConfidence(
  a: 'high' | 'medium' | 'low',
  b: 'high' | 'medium' | 'low',
): 'high' | 'medium' | 'low' {
  return CONFIDENCE_ORDER[a] <= CONFIDENCE_ORDER[b] ? a : b;
}

/**
 * distributedPassages üzerinden sefer sıklığı ve zaman bilgisi üretir.
 *
 * ÖNEMLİ: Geçişler arasında "bu daha boş" iddiası kurulmaz.
 * distributeHourlyPassengersToPassages eşit dağıtım yaptığı için
 * estimatedPassengers değerleri karşılaştırılmaz — yalnızca
 * passageCount, hat çeşitliliği ve zaman aralığı kullanılır.
 */
export function runScheduleAwareDensityAgent(
  distributedPassages: PassagePassengerDistribution[],
): ScheduleAwareDensityResult {
  if (distributedPassages.length === 0) {
    return {
      passageCount: 0,
      hasMultipleLines: false,
      earliestPassageTime: null,
      latestPassageTime: null,
      scheduleConfidenceLevel: 'low',
    };
  }

  const lineIds = new Set(distributedPassages.map((p) => p.lineId));
  const hasMultipleLines = lineIds.size > 1;

  // Listeler passengerDistributionUtils → stationPassageUtils tarafından
  // zaman sırasına göre sıralanmış gelir
  const earliest = distributedPassages[0]!.estimatedPassageTime;
  const latest = distributedPassages[distributedPassages.length - 1]!.estimatedPassageTime;

  let worstConfidence: 'high' | 'medium' | 'low' = 'high';
  for (const p of distributedPassages) {
    worstConfidence = lowerConfidence(worstConfidence, p.confidence);
  }

  return {
    passageCount: distributedPassages.length,
    hasMultipleLines,
    earliestPassageTime: earliest,
    latestPassageTime: latest,
    scheduleConfidenceLevel: worstConfidence,
  };
}
