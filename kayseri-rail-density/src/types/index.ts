export type PlatformType = 'single_area' | 'two_separate_areas';

export type PassengerRow = {
  tarih: string;
  durakId: string;
  durakAd: string;
  saat: number;
  yolcuSayisi: number;
};

/** Map + ekranlar: gerçek veya ML tahmin satırı (tarih, sayım ve tür) */
export type DisplayPassengerRow = {
  tarih: string;
  durakId: string;
  durakAd: string;
  saat: number;
  yolcuSayisi: number;
  dataType: 'actual' | 'prediction';
  /** Yalnızca tahmin satırlarında dolu. Model retrain sonrası anlamlı hale gelir. */
  weatherImpactScore?: number;
  /** 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' */
  weatherImpactLevel?: string;
  /** Yoğunluğu açıklayan bağlam faktörleri, örn. ["Sabah yoğunluğu", "Mesai çıkışı"] */
  mainFactors?: string[];
};

/** ml/train_model.py çıktısı (gün JSON dosyaları) */
export type PredictionFileRow = {
  durakId: string;
  durakAd: string;
  date: string;
  hour: number;
  predictedPassengerCount: number;
  /** 0.0–1.0 arası hava etkisi skoru (model yeniden eğitildikten sonra dolu gelir) */
  weatherImpactScore?: number;
  /** "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" */
  weatherImpactLevel?: string;
  /** Ana etki faktörleri, örn. ["Yağış", "Mesai çıkışı"] */
  mainFactors?: string[];
};

export type StationRecord = {
  /**
   * Unique ID for this display entry.
   * single_area  → original durakId (e.g. "1006001")
   * two_separate_areas → parentDurakId + suffix (e.g. "1006002_G" / "1006002_D")
   */
  durakId: string;
  /** Original station ID without _G/_D suffix. */
  parentDurakId: string;
  durakAd: string;
  latitude: number;
  longitude: number;
  /** OSM bulunamadıysa yaklaşık konum */
  approximate?: boolean;
  platformType: PlatformType;
  /** Only set for two_separate_areas platforms. */
  direction?: 'gidis' | 'donus';
};

/** Bir durakta bildirilen aktif arıza (admin tarafından oluşturulur/kaldırılır). */
export type StationFault = {
  /** Platformdan bağımsız durak kimliği (parentDurakId) — _G/_D'nin ikisini de kapsar */
  parentDurakId: string;
  durakAd: string;
  description: string;
  /** ISO 8601 zaman damgası */
  reportedAt: string;
};

export type HourlyPoint = { saat: number; yolcuSayisi: number };

/** Open-Meteo saatlik hava durumu satırı (fetchKayseriWeather2025 çıktısı). */
export type WeatherRow = {
  district: string;
  date: string;
  time: string;
  datetime: string;
  temperature: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
};

/** WeatherRow + tatil ve takvim feature'ları (buildWeatherHolidayDataset çıktısı). */
export type WeatherHolidayRow = WeatherRow & {
  isOfficialHoliday: boolean;
  isReligiousHoliday: boolean;
  isNationalHoliday: boolean;
  isHolidayEve: boolean;
  holidayName: string | null;
  holidayType: string | null;
  holidayDuration: number | null;
  expectedTransitImpact: string | null;
  dayOfWeek: number;
  month: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  explanationText: string;
};
