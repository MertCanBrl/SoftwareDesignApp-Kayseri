/**
 * Resmî tatil veri tipleri — JSON dosyalarından yüklenir, uygulama ve script tarafında paylaşılır.
 */

export type HolidayType = 'official_holiday' | 'religious_holiday' | 'national_holiday';
export type TransitImpact = 'low' | 'medium' | 'high';

export type HolidayEntry = {
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly durationDays: number;
  readonly dayRange: string;
  readonly type: HolidayType;
  readonly expectedTransitImpact: TransitImpact;
  readonly reason: string;
};

export type HolidayFile = {
  readonly year: number;
  readonly country: 'TR';
  readonly holidays: readonly HolidayEntry[];
};

/** Belirli bir tarih için hesaplanan tatil bilgisi. */
export type HolidayInfo = {
  isOfficialHoliday: boolean;
  isReligiousHoliday: boolean;
  isNationalHoliday: boolean;
  isHolidayEve: boolean;
  holidayName: string | null;
  holidayType: HolidayType | null;
  holidayDuration: number | null;
  expectedTransitImpact: TransitImpact | null;
};

/** Hava durumu olmadan yalnızca tatil feature'larını içeren satır (2026 tahmin datası için). */
export type HolidayFeatureRow = {
  date: string;
  isOfficialHoliday: boolean;
  isReligiousHoliday: boolean;
  isNationalHoliday: boolean;
  isHolidayEve: boolean;
  holidayName: string | null;
  holidayType: HolidayType | null;
  holidayDuration: number | null;
  expectedTransitImpact: TransitImpact | null;
  dayOfWeek: number;
  month: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  explanationText: string;
};
