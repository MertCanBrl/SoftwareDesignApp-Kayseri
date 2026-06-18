import type { EstimatedStationPassage } from '../transitNetwork/stationPassageUtils';
import type { PassagePassengerDistribution } from '../transitNetwork/passengerDistributionUtils';

export type ServiceDayType = 'weekday' | 'saturday' | 'sunday';
export type DataType = 'actual' | 'prediction';
export type PredictionConfidence = 'high' | 'medium' | 'low';

export type NearbyStationDensity = {
  stationId: string;
  stationName: string;
  densityLabel: string;
  passengerCount: number;
  distanceMeters: number;
};

export type TravelAction =
  | 'go_now'
  | 'wait_for_passage'
  | 'use_nearby_station'
  | 'check_next_hour'
  | 'be_prepared'
  | 'no_data';

export type UserRecommendationInput = {
  stationId: string;
  stationName: string;
  /** "YYYY-MM-DD" */
  selectedDate: string;
  /** 0–23 */
  selectedHour: number;
  /** selectedCount (hero'dan gelen değer; parent görünümde _G+_D toplamı) */
  hourlyPassengerCount: number;
  /** getDensityLevel(hourlyPassengerCount).label */
  densityLevel: string;
  /** 1=Seyrek … 7=Kapasite Aşımı; DENSITY_ORDER ile uyumlu */
  densityRank: number;
  /** getEstimatedStationPassages çıktısı; confidence=high ile filtrelenmiş */
  estimatedPassages: EstimatedStationPassage[];
  /** distributeHourlyPassengersToPassages çıktısı */
  distributedPassages: PassagePassengerDistribution[];
  /** Aşama 3'te doldurulacak; şimdilik [] */
  nearbyStationsDensity: NearbyStationDensity[];
  dataType: DataType;
  /** Yalnızca dataType=prediction için; actual ise null */
  predictionConfidence: PredictionConfidence | null;
  serviceDayType: ServiceDayType;
  /** Durak parent görünümünde mi? (_G/_D alt durakların toplamı) */
  isParentView: boolean;
};

export type UserRecommendationOutput = {
  action: TravelAction;
  /** ≤ 60 karakter; kullanıcıya dönük başlık */
  headline: string;
  /** 1–2 cümle; tahmini dil kullanılır */
  detail: string;
  /** "HH:MM" — en erken tahmini geçiş saati */
  recommendedPassageTime?: string;
  /** use_nearby_station aksiyonunda dolar (Aşama 3) */
  nearbyStationName?: string;
  /** Genel güven düzeyi */
  confidence: 'low' | 'medium' | 'high';
  /**
   * Kart altında gösterilecek küçük uyarı notu.
   * SafetyExplanationAgent tarafından her zaman eklenir.
   */
  explanation: string;
};
