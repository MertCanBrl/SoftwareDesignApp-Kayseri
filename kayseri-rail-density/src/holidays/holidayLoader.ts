/**
 * Tatil yükleyici — JSON veri dosyalarından tatil bilgisi üretir ve hava durumu verisiyle birleştirir.
 * React Native ve Node.js ortamlarında çalışır (fs bağımlılığı yok).
 */
import type { HolidayEntry, HolidayFeatureRow, HolidayFile, HolidayInfo, TransitImpact } from './holidayTypes';
import type { WeatherHolidayRow, WeatherRow } from '../types';

// ── Statik JSON yükleyiciler ──────────────────────────────────────────────────
// resolveJsonModule: true ile TypeScript doğrudan JSON import eder.

import holidays2025Data from '../../assets/data/holidays/turkey-official-holidays-2025.json';
import holidays2026Data from '../../assets/data/holidays/turkey-official-holidays-2026.json';

export function getHolidaysForYear(year: number): readonly HolidayEntry[] {
  if (year === 2025) return holidays2025Data.holidays as HolidayEntry[];
  if (year === 2026) return holidays2026Data.holidays as HolidayEntry[];
  return [];
}

// ── Tarih yardımcıları ────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// ── Tatil sorgulama ───────────────────────────────────────────────────────────

/**
 * Verilen tarih için tatil bilgisi hesaplar.
 * holidays: getHolidaysForYear(year) çıktısı veya manuel liste.
 */
export function getHolidayInfo(date: string, holidays: readonly HolidayEntry[]): HolidayInfo {
  const match = holidays.find((h) => date >= h.startDate && date <= h.endDate) ?? null;
  const isHolidayEve = holidays.some((h) => addDays(h.startDate, -1) === date);

  if (!match) {
    return {
      isOfficialHoliday: false,
      isReligiousHoliday: false,
      isNationalHoliday: false,
      isHolidayEve,
      holidayName: null,
      holidayType: null,
      holidayDuration: null,
      expectedTransitImpact: null,
    };
  }

  return {
    isOfficialHoliday: true,
    isReligiousHoliday: match.type === 'religious_holiday',
    isNationalHoliday: match.type === 'national_holiday',
    isHolidayEve,
    holidayName: match.name,
    holidayType: match.type,
    holidayDuration: match.durationDays,
    expectedTransitImpact: match.expectedTransitImpact,
  };
}

// ── Açıklama metin üreticileri ────────────────────────────────────────────────

type WeatherSignals = {
  precipitation: number;
  rain: number;
  snowfall: number;
  windSpeed: number;
  windGusts: number;
};

function buildCauses(
  date: string,
  info: HolidayInfo,
  holidayStartDate: string | null,
  weather?: WeatherSignals
): string[] {
  const causes: string[] = [];

  if (info.isOfficialHoliday && info.holidayName) {
    const suffix = date === holidayStartDate ? ' başlangıcı' : '';
    causes.push(`${info.holidayName}${suffix}`);
  } else if (info.isHolidayEve) {
    causes.push('bayram arifesi');
  }

  if (weather) {
    if (weather.snowfall > 0.3) {
      causes.push('karlı hava koşulları');
    } else if (weather.precipitation > 3 || weather.rain > 1) {
      causes.push('yağışlı hava koşulları');
    }
    if (weather.windSpeed > 40 || weather.windGusts > 60) {
      causes.push('kuvvetli rüzgar');
    }
  }

  return causes;
}

export function buildWeatherExplanationText(
  date: string,
  info: HolidayInfo,
  holidayStartDate: string | null,
  weather: WeatherSignals
): string {
  const causes = buildCauses(date, info, holidayStartDate, weather);
  if (causes.length === 0) return '';
  return `${date} tarihinde ${causes.join(' ve ')} nedeniyle bazı hatlarda normal güne göre farklı yolcu yoğunluğu beklenebilir.`;
}

export function buildHolidayExplanationText(
  date: string,
  info: HolidayInfo,
  holidayStartDate: string | null
): string {
  const causes = buildCauses(date, info, holidayStartDate);
  if (causes.length === 0) return '';
  return `${date} tarihinde ${causes.join(' ve ')} nedeniyle bazı hatlarda normal güne göre farklı yolcu yoğunluğu beklenebilir.`;
}

// ── Zenginleştirme fonksiyonları ──────────────────────────────────────────────

/**
 * Hava durumu satırlarını tatil ve takvim feature'larıyla zenginleştirir.
 * 2025 geçmiş analiz datası için kullanılır.
 */
export function enrichWeatherWithHolidayData(
  weatherRows: readonly WeatherRow[],
  holidays: readonly HolidayEntry[]
): WeatherHolidayRow[] {
  // Aynı tarih için getHolidayInfo'yu tekrar hesaplamamak adına cache
  const infoCache = new Map<string, { info: HolidayInfo; startDate: string | null }>();

  function getCached(date: string) {
    if (!infoCache.has(date)) {
      const info = getHolidayInfo(date, holidays);
      const matchingHoliday = info.isOfficialHoliday
        ? holidays.find((h) => date >= h.startDate && date <= h.endDate) ?? null
        : null;
      infoCache.set(date, { info, startDate: matchingHoliday?.startDate ?? null });
    }
    return infoCache.get(date)!;
  }

  return weatherRows.map((row) => {
    const { info, startDate } = getCached(row.date);
    const dateParsed = new Date(row.date + 'T00:00:00');
    const month = dateParsed.getMonth() + 1;
    const season = getSeason(month);
    const dayOfWeek = dateParsed.getDay();

    const explanationText = buildWeatherExplanationText(row.date, info, startDate, {
      precipitation: row.precipitation,
      rain: row.rain,
      snowfall: row.snowfall,
      windSpeed: row.windSpeed,
      windGusts: row.windGusts,
    });

    return {
      ...row,
      isOfficialHoliday: info.isOfficialHoliday,
      isReligiousHoliday: info.isReligiousHoliday,
      isNationalHoliday: info.isNationalHoliday,
      isHolidayEve: info.isHolidayEve,
      holidayName: info.holidayName,
      holidayType: info.holidayType,
      holidayDuration: info.holidayDuration,
      expectedTransitImpact: info.expectedTransitImpact,
      dayOfWeek,
      month,
      season,
      explanationText,
    };
  });
}

/**
 * Belirli bir yıl için tüm günleri tatil feature satırı olarak üretir.
 * 2026 tahmin datası ile birleştirmek için kullanılır.
 */
export function buildHolidayFeatureRows(
  year: number,
  holidays: readonly HolidayEntry[]
): HolidayFeatureRow[] {
  const rows: HolidayFeatureRow[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const date = [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0'),
    ].join('-');

    const info = getHolidayInfo(date, holidays);
    const matchingHoliday = info.isOfficialHoliday
      ? holidays.find((h) => date >= h.startDate && date <= h.endDate) ?? null
      : null;

    const month = dt.getMonth() + 1;
    const season = getSeason(month);
    const dayOfWeek = dt.getDay();

    const explanationText = buildHolidayExplanationText(
      date,
      info,
      matchingHoliday?.startDate ?? null
    );

    rows.push({
      date,
      isOfficialHoliday: info.isOfficialHoliday,
      isReligiousHoliday: info.isReligiousHoliday,
      isNationalHoliday: info.isNationalHoliday,
      isHolidayEve: info.isHolidayEve,
      holidayName: info.holidayName,
      holidayType: info.holidayType,
      holidayDuration: info.holidayDuration,
      expectedTransitImpact: info.expectedTransitImpact as TransitImpact | null,
      dayOfWeek,
      month,
      season,
      explanationText,
    });
  }

  return rows;
}
