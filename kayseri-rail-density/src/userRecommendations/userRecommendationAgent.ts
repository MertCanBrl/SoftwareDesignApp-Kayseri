import type { UserRecommendationInput, UserRecommendationOutput, PredictionConfidence } from './userRecommendationTypes';
import type { PassengerContextResult } from './passengerContextAgent';
import type { ScheduleAwareDensityResult } from './scheduleAwareDensityAgent';
import type { NearbyAlternativeResult } from './nearbyAlternativeAgent';

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

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

function predConfToOutput(pc: PredictionConfidence | null): 'high' | 'medium' | 'low' {
  if (pc === null) return 'high'; // actual veri
  return pc; // 'high' | 'medium' | 'low' doğrudan eşleşiyor
}

function resolveOutputConfidence(
  input: UserRecommendationInput,
  scheduleResult: ScheduleAwareDensityResult | null,
): 'high' | 'medium' | 'low' {
  const dataConf = predConfToOutput(input.predictionConfidence);
  if (scheduleResult === null) return dataConf;
  return lowerConfidence(dataConf, scheduleResult.scheduleConfidenceLevel);
}

// ---------------------------------------------------------------------------
// Karar ağacı girdisi
// ---------------------------------------------------------------------------

export type UserRecommendationAgentInput = {
  contextResult: PassengerContextResult;
  /** null ise sefer çizelgesi verisi yok (noScheduleData=true) */
  scheduleResult: ScheduleAwareDensityResult | null;
  nearbyResult: NearbyAlternativeResult;
  input: UserRecommendationInput;
};

// ---------------------------------------------------------------------------
// İç metin üretici yardımcılar
// ---------------------------------------------------------------------------

const SAFE_EXPLANATION =
  'Sefer çizelgesine göre tahminidir. Gerçek zamanlı konum değildir. ±2-5 dk sapma olabilir.';

function makeNoData(reason: string): UserRecommendationOutput {
  return {
    action: 'no_data',
    headline: 'Yeterli veri yok',
    detail: reason,
    confidence: 'low',
    explanation: SAFE_EXPLANATION,
  };
}

function makeConfidenceLow(): UserRecommendationOutput {
  return {
    action: 'no_data',
    headline: 'Tahmin belirsizliği yüksek',
    detail:
      'Seçilen tarih 30+ gün ileride; bu süre için öneri sunmak güvenilir değil. ' +
      'Tarihe yaklaştıkça daha doğru bir öneri oluşturulabilir.',
    confidence: 'low',
    explanation: SAFE_EXPLANATION,
  };
}

function makeGoNow(
  input: UserRecommendationInput,
  scheduleResult: ScheduleAwareDensityResult | null,
  outputConfidence: 'high' | 'medium' | 'low',
): UserRecommendationOutput {
  const prefix = input.dataType === 'prediction' ? 'Tahmine göre' : 'Görünen';
  let detail = `${prefix} bu saatte yoğunluk ${input.densityLevel} seviyesinde görünüyor.`;

  if (scheduleResult && scheduleResult.passageCount > 0) {
    const lineNote = scheduleResult.hasMultipleLines
      ? 'Birden fazla hat'
      : 'Sefer çizelgesine göre';
    detail +=
      ` ${lineNote} bu saat içinde yaklaşık ${scheduleResult.passageCount} geçiş bekleniyor.`;
  }

  return {
    action: 'go_now',
    headline: 'Şu an gitmek uygun görünüyor',
    detail,
    recommendedPassageTime: scheduleResult?.earliestPassageTime ?? undefined,
    confidence: outputConfidence,
    explanation: SAFE_EXPLANATION,
  };
}

function makeWaitForPassage(
  input: UserRecommendationInput,
  scheduleResult: ScheduleAwareDensityResult,
  outputConfidence: 'high' | 'medium' | 'low',
): UserRecommendationOutput {
  const multiLineNote = scheduleResult.hasMultipleLines
    ? ' Birden fazla hat bu durağa hizmet veriyor.'
    : '';

  const detail =
    `Bu saat içinde yaklaşık ${scheduleResult.passageCount} sefer bekleniyor.${multiLineNote} ` +
    `Yoğunluk ${input.densityLevel} düzeyinde görünüyor; erken varışla yer bulmak daha kolay olabilir.`;

  return {
    action: 'wait_for_passage',
    headline: 'Sefer sıklığı yeterli — uygun geçiş bekleniyor',
    detail,
    recommendedPassageTime: scheduleResult.earliestPassageTime ?? undefined,
    confidence: outputConfidence,
    explanation: SAFE_EXPLANATION,
  };
}

function makeCheckNextHour(
  input: UserRecommendationInput,
  scheduleResult: ScheduleAwareDensityResult | null,
  outputConfidence: 'high' | 'medium' | 'low',
): UserRecommendationOutput {
  let detail =
    `Yoğunluk ${input.densityLevel} seviyesinde görünüyor. ` +
    'Mümkünse bir sonraki saati tercih etmek daha rahat bir yolculuk sağlayabilir.';

  if (scheduleResult && scheduleResult.passageCount > 0) {
    detail +=
      ` Bu saat içinde yaklaşık ${scheduleResult.passageCount} sefer bekleniyor; ` +
      'ancak doluluk yoğun olabilir.';
  }

  return {
    action: 'check_next_hour',
    headline: 'Bu saat yoğun — sonraki saati değerlendirin',
    detail,
    confidence: outputConfidence,
    explanation: SAFE_EXPLANATION,
  };
}

function makeBePrepared(
  input: UserRecommendationInput,
  scheduleResult: ScheduleAwareDensityResult | null,
  outputConfidence: 'high' | 'medium' | 'low',
): UserRecommendationOutput {
  let detail =
    `Bu saatte yoğunluk ${input.densityLevel} düzeyinde görünüyor. `;

  if (scheduleResult && scheduleResult.passageCount > 0) {
    detail +=
      `Sefer çizelgesine göre yaklaşık ${scheduleResult.passageCount} geçiş bekleniyor; ` +
      'hazırlıklı olmak önerilebilir.';
  } else {
    detail += 'Seyahat planlamak için hazırlıklı olmak önerilebilir.';
  }

  return {
    action: 'be_prepared',
    headline: `Bu saatte yoğunluk ${input.densityLevel}`,
    detail,
    confidence: outputConfidence,
    explanation: SAFE_EXPLANATION,
  };
}

function makeFallbackHourly(
  input: UserRecommendationInput,
  outputConfidence: 'high' | 'medium' | 'low',
): UserRecommendationOutput {
  // Sefer çizelgesi verisi yok; densityRank üzerinden sade öneri
  if (input.densityRank <= 3) {
    return {
      action: 'go_now',
      headline: 'Şu an gitmek uygun görünüyor',
      detail: `Bu saatte yoğunluk ${input.densityLevel} seviyesinde görünüyor.`,
      confidence: outputConfidence,
      explanation: SAFE_EXPLANATION,
    };
  }
  if (input.densityRank >= 6) {
    return {
      action: 'be_prepared',
      headline: `Bu saatte yoğunluk ${input.densityLevel}`,
      detail:
        `Yoğunluk ${input.densityLevel} düzeyinde görünüyor. ` +
        'Mümkünse farklı bir saat tercih edilebilir.',
      confidence: outputConfidence,
      explanation: SAFE_EXPLANATION,
    };
  }
  // Orta (4–5)
  return {
    action: 'be_prepared',
    headline: `Bu saatte yoğunluk ${input.densityLevel}`,
    detail:
      `Yoğunluk ${input.densityLevel} düzeyinde görünüyor. ` +
      'Sefer çizelgesi bilgisi bu durak için mevcut değil.',
    confidence: outputConfidence,
    explanation: SAFE_EXPLANATION,
  };
}

// ---------------------------------------------------------------------------
// Ana karar ağacı
// ---------------------------------------------------------------------------

/**
 * Tüm agent çıktılarını okuyarak tek bir UserRecommendationOutput üretir.
 *
 * Karar öncelik sırası:
 * 1. Geçersiz girdi          → no_data
 * 2. Low prediction conf     → no_data
 * 3. Sefer verisi yok        → saatlik fallback
 * 4. densityRank <= 3        → go_now
 * 5. densityRank >= 6        → check_next_hour
 * 6. densityRank 4–5:
 *    passageCount >= 3       → wait_for_passage
 *    diğer                  → be_prepared
 */
export function runUserRecommendationAgent(
  params: UserRecommendationAgentInput,
): UserRecommendationOutput {
  const { contextResult, scheduleResult, input } = params;

  // 1. Geçersiz girdi
  if (!contextResult.valid) {
    return makeNoData(contextResult.invalidReason ?? 'Girdi doğrulanamadı');
  }

  // 2. Prediction confidence çok düşük
  if (contextResult.confidenceTooLow) {
    return makeConfidenceLow();
  }

  const outputConfidence = resolveOutputConfidence(input, scheduleResult);

  // 3. Sefer çizelgesi verisi yok → saatlik fallback
  if (contextResult.noScheduleData || scheduleResult === null) {
    return makeFallbackHourly(input, outputConfidence);
  }

  const rank = input.densityRank;

  // 4. Düşük yoğunluk: gitmek uygun
  if (rank <= 3) {
    return makeGoNow(input, scheduleResult, outputConfidence);
  }

  // 5. Çok yüksek yoğunluk: sonraki saati öner
  if (rank >= 6) {
    return makeCheckNextHour(input, scheduleResult, outputConfidence);
  }

  // 6. Orta yoğunluk (rank 4–5)
  if (scheduleResult.passageCount >= 3) {
    return makeWaitForPassage(input, scheduleResult, outputConfidence);
  }

  return makeBePrepared(input, scheduleResult, outputConfidence);
}
