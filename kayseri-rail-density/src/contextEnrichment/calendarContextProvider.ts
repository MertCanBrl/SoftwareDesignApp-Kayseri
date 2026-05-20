import {
  HOLIDAY_EVES_2025,
  OFFICIAL_HOLIDAYS_2025,
  RELIGIOUS_HOLIDAYS_2025,
  SCHOOL_MIDTERM_BREAK_RANGES,
  SCHOOL_TERM_RANGES,
  UNIVERSITY_BREAK_RANGES,
  UNIVERSITY_TERM_RANGES,
} from './calendarContextConfig';
import type { AcademicPeriod, CalendarContext } from './contextTypes';
import {
  isDateInAnyRange,
  isDateInList,
  isWeekendDate,
  parseYmd,
} from './contextEnrichmentUtils';

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
 * Tarihten takvim bağlamı üretir (heuristic / mock tatil listeleri).
 */
export function getCalendarContext(date: string): CalendarContext {
  const isWeekend = isWeekendDate(date);
  const isOfficialHoliday = isDateInList(date, OFFICIAL_HOLIDAYS_2025);
  const isReligiousHoliday = isDateInList(date, RELIGIOUS_HOLIDAYS_2025);
  const isHolidayEve = isDateInList(date, HOLIDAY_EVES_2025);
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
