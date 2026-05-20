/**
 * Takvim/heuristic yapılandırması — tarih aralıkları ve tatil listeleri.
 * Gerçek API yerine mock/configurable veri kaynağı.
 */

/** YYYY-MM-DD dahil aralık. */
export type DateRange = {
  start: string;
  end: string;
  label?: string;
};

export const OFFICIAL_HOLIDAYS_2025: readonly string[] = [
  '2025-01-01',
  '2025-03-30',
  '2025-03-31',
  '2025-04-01',
  '2025-04-23',
  '2025-05-01',
  '2025-05-19',
  '2025-06-06',
  '2025-06-07',
  '2025-06-08',
  '2025-06-09',
  '2025-07-15',
  '2025-08-30',
  '2025-10-28',
  '2025-10-29',
];

/** Dini bayram günleri (mock 2025). */
export const RELIGIOUS_HOLIDAYS_2025: readonly string[] = [
  '2025-03-30',
  '2025-03-31',
  '2025-04-01',
  '2025-06-06',
  '2025-06-07',
  '2025-06-08',
  '2025-06-09',
];

/** Bayram arifesi (mock 2025). */
export const HOLIDAY_EVES_2025: readonly string[] = [
  '2025-03-29',
  '2025-06-05',
  '2025-10-27',
];

/** İlkokul/lise dönemleri (2024-2025 öğretim yılı örneği). */
export const SCHOOL_TERM_RANGES: readonly DateRange[] = [
  { start: '2024-09-09', end: '2025-01-17', label: 'Güz dönemi' },
  { start: '2025-02-10', end: '2025-06-13', label: 'Bahar dönemi' },
];

export const SCHOOL_MIDTERM_BREAK_RANGES: readonly DateRange[] = [
  { start: '2025-01-20', end: '2025-01-31', label: 'Ara tatil' },
  { start: '2025-04-14', end: '2025-04-18', label: 'Yarıyıl tatili' },
];

/** Üniversite dönemleri (Erciyes örneği — yapılandırılabilir). */
export const UNIVERSITY_TERM_RANGES: readonly DateRange[] = [
  { start: '2024-09-16', end: '2025-01-24', label: 'Güz' },
  { start: '2025-02-03', end: '2025-06-20', label: 'Bahar' },
];

export const UNIVERSITY_BREAK_RANGES: readonly DateRange[] = [
  { start: '2025-01-25', end: '2025-02-02', label: 'Kış ara tatili' },
  { start: '2025-06-21', end: '2025-09-14', label: 'Yaz tatili' },
];
