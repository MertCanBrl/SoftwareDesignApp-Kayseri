import type { UserRecommendationInput } from './userRecommendationTypes';

export type PassengerContextResult = {
  /** Girdi geçerliyse true */
  valid: boolean;
  /** valid=false ise sebebi */
  invalidReason?: string;
  /**
   * true → prediction verisi 30+ gün ileride; güvenilir öneri üretilemiyor.
   * valid=true ile bir arada gelebilir — pipeline no_data üretir ama crash etmez.
   */
  confidenceTooLow: boolean;
  /**
   * true → estimatedPassages veya distributedPassages boş;
   * ScheduleAwareDensityAgent atlanır, genel saatlik mantığa fallback yapılır.
   */
  noScheduleData: boolean;
  /** Normalize edilmiş girdi (densityRank ve passengerCount kısıtlandı) */
  normalizedInput: UserRecommendationInput;
};

export function runPassengerContextAgent(
  input: UserRecommendationInput,
): PassengerContextResult {
  const base: Omit<PassengerContextResult, 'valid' | 'invalidReason'> = {
    confidenceTooLow: false,
    noScheduleData: true,
    normalizedInput: input,
  };

  if (!input.stationId || !input.stationName) {
    return { ...base, valid: false, invalidReason: 'Durak bilgisi eksik' };
  }

  if (input.selectedHour < 0 || input.selectedHour > 23) {
    return { ...base, valid: false, invalidReason: 'Geçersiz saat değeri' };
  }

  if (input.hourlyPassengerCount < 0) {
    return { ...base, valid: false, invalidReason: 'Yolcu sayısı negatif olamaz' };
  }

  const confidenceTooLow =
    input.dataType === 'prediction' && input.predictionConfidence === 'low';

  const noScheduleData =
    input.estimatedPassages.length === 0 || input.distributedPassages.length === 0;

  const normalizedInput: UserRecommendationInput = {
    ...input,
    densityRank: Math.max(1, Math.min(7, input.densityRank)),
    hourlyPassengerCount: Math.max(0, input.hourlyPassengerCount),
  };

  return {
    valid: true,
    confidenceTooLow,
    noScheduleData,
    normalizedInput,
  };
}
