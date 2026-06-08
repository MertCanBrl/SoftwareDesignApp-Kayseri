/**
 * Takvim/heuristic yapılandırması — okul ve üniversite dönem aralıkları.
 * Tatil verileri assets/data/holidays/ altındaki JSON dosyalarına taşındı.
 */

/** YYYY-MM-DD dahil aralık. */
export type DateRange = {
  start: string;
  end: string;
  label?: string;
};

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
