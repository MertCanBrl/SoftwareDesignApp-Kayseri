import {
  SCHOOL_MIDTERM_BREAK_RANGES,
  SCHOOL_TERM_RANGES,
  UNIVERSITY_BREAK_RANGES,
  UNIVERSITY_TERM_RANGES,
} from './calendarContextConfig';
import type { AcademicPeriod, CalendarContext } from './contextTypes';
import {
  isDateInAnyRange,
  isWeekendDate,
  parseYmd,
} from './contextEnrichmentUtils';
import { getHolidayInfo, getHolidaysForYear } from '../holidays/holidayLoader';

const WEEKDAY_NAMES = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

/**
 * Tarihten takvim bağlamı üretir.
 * Tatil verisi JSON dosyalarından (2025/2026) yüklenir; diğer yıllar için tatil olmayan davranış gösterir.
 */
export function getCalendarContext(date: string): CalendarContext {
  const year = parseInt(date.slice(0, 4), 10);
  const holidays = getHolidaysForYear(year);
  const info = getHolidayInfo(date, holidays);

  const isWeekend = isWeekendDate(date);
  const isOfficialHoliday = info.isOfficialHoliday;
  const isReligiousHoliday = info.isReligiousHoliday;
  const isHolidayEve = info.isHolidayEve;
  const isMidtermBreak = isDateInAnyRange(date, SCHOOL_MIDTERM_BREAK_RANGES);
  const isSchoolTerm =
    isDateInAnyRange(date, SCHOOL_TERM_RANGES) && !isMidtermBreak;
  const isUniversityBreak = isDateInAnyRange(date, UNIVERSITY_BREAK_RANGES);
  const isUniversityTerm =
    isDateInAnyRange(date, UNIVERSITY_TERM_RANGES) && !isUniversityBreak;

  const academicPeriod = resolveAcademicPeriod({
    isOfficialHoliday,
    isReligiousHoliday,
    isMidtermBreak,
    isSchoolTerm,
    isUniversityTerm,
    isUniversityBreak,
  });

  const dayLabel = buildDayLabel(date, isWeekend, isOfficialHoliday, isReligiousHoliday);

  return {
    date,
    isWeekend,
    isOfficialHoliday,
    isReligiousHoliday,
    isHolidayEve,
    isSchoolTerm,
    isMidtermBreak,
    isUniversityTerm,
    academicPeriod,
    dayLabel,
  };
}

function resolveAcademicPeriod(flags: {
  isOfficialHoliday: boolean;
  isReligiousHoliday: boolean;
  isMidtermBreak: boolean;
  isSchoolTerm: boolean;
  isUniversityTerm: boolean;
  isUniversityBreak: boolean;
}): AcademicPeriod {
  if (flags.isOfficialHoliday || flags.isReligiousHoliday) return 'HOLIDAY';
  if (flags.isMidtermBreak) return 'SCHOOL_BREAK';
  if (flags.isUniversityBreak) return 'UNIVERSITY_BREAK';
  if (flags.isSchoolTerm && flags.isUniversityTerm) return 'SCHOOL_TERM';
  if (flags.isSchoolTerm) return 'SCHOOL_TERM';
  if (flags.isUniversityTerm) return 'UNIVERSITY_TERM';
  return 'OUT_OF_SESSION';
}

function buildDayLabel(
  date: string,
  isWeekend: boolean,
  isOfficialHoliday: boolean,
  isReligiousHoliday: boolean
): string {
  const parsed = parseYmd(date);
  const weekday = parsed ? WEEKDAY_NAMES[parsed.getDay()]! : 'Bilinmeyen gün';

  if (isOfficialHoliday && isReligiousHoliday) return `${weekday} (resmi ve dini tatil)`;
  if (isOfficialHoliday) return `${weekday} (resmi tatil)`;
  if (isReligiousHoliday) return `${weekday} (dini bayram)`;
  if (isWeekend) return `${weekday} (hafta sonu)`;
  return `${weekday} (hafta içi)`;
}
