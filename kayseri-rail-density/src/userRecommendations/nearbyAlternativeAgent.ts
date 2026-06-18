import type { NearbyStationDensity } from './userRecommendationTypes';

/**
 * Aşama 3'te gerçek implementasyon yapılacak.
 * Şimdilik stub: her zaman "yakın alternatif yok" döndürür.
 *
 * Gerçek implementasyon:
 * - nearbyStationsDensity listesini haversine mesafesine göre filtreler
 * - densityRank farkı >= 2 olan alternatifleri "viable" sayar
 * - En iyi alternatifi bestAlternative olarak döndürür
 */
export type NearbyAlternativeResult = {
  hasViableAlternative: false;
  bestAlternative: null;
  densityImprovement: 0;
};

export function runNearbyAlternativeAgent(
  _nearbyStationsDensity: NearbyStationDensity[],
  _currentDensityRank: number,
): NearbyAlternativeResult {
  return {
    hasViableAlternative: false,
    bestAlternative: null,
    densityImprovement: 0,
  };
}
