import type { UserRecommendationInput, UserRecommendationOutput } from './userRecommendationTypes';
import { runPassengerContextAgent } from './passengerContextAgent';
import { runScheduleAwareDensityAgent } from './scheduleAwareDensityAgent';
import { runNearbyAlternativeAgent } from './nearbyAlternativeAgent';
import { runUserRecommendationAgent } from './userRecommendationAgent';
import { runSafetyExplanationAgent } from './safetyExplanationAgent';
import type { ScheduleAwareDensityResult } from './scheduleAwareDensityAgent';

/**
 * Kullanıcı odaklı seyahat öneri pipeline'ı.
 *
 * Tüm adımlar senkron ve deterministik; LLM, async veya network kullanılmaz.
 * Sayısal değer üretilmez — StationDetailScreen'den gelen hazır veriler yorumlanır.
 *
 * Pipeline akışı:
 *   PassengerContextAgent        → girdi doğrulama
 *   ScheduleAwareDensityAgent    → sefer sıklığı analizi (sefer verisi varsa)
 *   NearbyAlternativeAgent       → yakın durak (Aşama 3'e kadar stub)
 *   UserRecommendationAgent      → karar ağacı
 *   SafetyExplanationAgent       → metin filtresi
 *
 * Municipality pipeline'ına (transitDecisionPipeline) dokunmaz.
 * recommendations.ts fonksiyonlarını değiştirmez.
 */
export function runUserRecommendationPipeline(
  input: UserRecommendationInput,
): UserRecommendationOutput {
  // 1. Girdi doğrulama + bağlam normalizasyonu
  const contextResult = runPassengerContextAgent(input);

  // 2. Sefer çizelgesi analizi (yalnızca sefer verisi varsa)
  let scheduleResult: ScheduleAwareDensityResult | null = null;
  if (contextResult.valid && !contextResult.noScheduleData) {
    scheduleResult = runScheduleAwareDensityAgent(
      contextResult.normalizedInput.distributedPassages,
    );
  }

  // 3. Yakın durak alternatifleri (Aşama 3'e kadar stub)
  const nearbyResult = runNearbyAlternativeAgent(
    contextResult.normalizedInput.nearbyStationsDensity,
    contextResult.normalizedInput.densityRank,
  );

  // 4. Karar üretimi
  const rawOutput = runUserRecommendationAgent({
    contextResult,
    scheduleResult,
    nearbyResult,
    input: contextResult.normalizedInput,
  });

  // 5. Metin güvenlik filtresi
  return runSafetyExplanationAgent(rawOutput);
}
