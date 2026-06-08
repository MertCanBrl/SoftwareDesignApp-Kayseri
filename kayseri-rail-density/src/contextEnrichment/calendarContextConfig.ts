/**
 * Takvim/heuristic yapılandırması — okul ve üniversite dönem aralıkları.
 * Tatil verileri assets/data/holidays/ altındaki JSON dosyalarına taşındı.
 */

// ── Temel tip ──────────────────────────────────────────────────────────────

/** YYYY-MM-DD dahil aralık. */
export type DateRange = {
  start: string;
  end: string;
  label?: string;
};

// ── Okul takvimi (değişmedi) ───────────────────────────────────────────────

/** İlkokul/lise dönemleri. */
export const SCHOOL_TERM_RANGES: readonly DateRange[] = [
  { start: '2024-09-09', end: '2025-01-17', label: '2024-25 Güz dönemi' },
  { start: '2025-02-10', end: '2025-06-13', label: '2024-25 Bahar dönemi' },
  { start: '2025-09-08', end: '2026-01-16', label: '2025-26 Güz dönemi' },
  { start: '2026-02-09', end: '2026-06-12', label: '2025-26 Bahar dönemi' },
  // TODO: 2026-27 MEB takvimi yayımlandığında ekle
];

export const SCHOOL_MIDTERM_BREAK_RANGES: readonly DateRange[] = [
  { start: '2025-01-20', end: '2025-01-31', label: '2024-25 Güz ara tatil' },
  { start: '2025-04-14', end: '2025-04-18', label: '2024-25 Bahar yarıyıl tatili' },
  { start: '2026-01-19', end: '2026-01-30', label: '2025-26 Güz ara tatil' },
  { start: '2026-04-13', end: '2026-04-17', label: '2025-26 Bahar yarıyıl tatili' },
  // TODO: 2026-27 MEB takvimi yayımlandığında ekle
];

// ── Üniversite dönem aralıkları (flat — geriye dönük uyumluluk) ─────────────

export const UNIVERSITY_TERM_RANGES: readonly DateRange[] = [
  // 2024-25
  { start: '2024-09-16', end: '2025-01-24', label: '2024-25 Güz' },
  { start: '2025-02-03', end: '2025-06-20', label: '2024-25 Bahar' },
  // 2025-26 — ERÜ + KÜ (doğrulanmış JSON)
  { start: '2025-09-15', end: '2026-02-01', label: 'ERÜ 2025-26 Güz (ders + final + bütünleme)' },
  { start: '2026-02-09', end: '2026-07-12', label: 'ERÜ 2025-26 Bahar (ders + final + bütünleme)' },
  // 2026-27 — NNY (doğrulanmış JSON)
  { start: '2026-09-07', end: '2027-02-05', label: 'NNY 2026-27 Güz (kayıt + ders + final + bütünleme)' },
  { start: '2027-02-08', end: '2027-07-09', label: 'NNY 2026-27 Bahar (kayıt + ders + final + bütünleme)' },
  // TODO: Kayseri Üniversitesi 2026-27 ve Erciyes 2026-27 verileri eklenecek
];

export const UNIVERSITY_BREAK_RANGES: readonly DateRange[] = [
  // 2024-25
  { start: '2025-01-25', end: '2025-02-02', label: '2024-25 Kış ara tatili' },
  { start: '2025-06-21', end: '2025-09-14', label: '2024-25 Yaz tatili' },
  // 2025-26
  { start: '2026-01-24', end: '2026-02-01', label: '2025-26 Kış ara tatili' },
  { start: '2026-06-20', end: '2026-09-13', label: '2025-26 Yaz tatili' },
  // 2026-27 — NNY (doğrulanmış JSON)
  { start: '2027-01-16', end: '2027-01-24', label: 'NNY 2026-27 Güz sonu tatili' },
  { start: '2027-06-26', end: '2027-09-13', label: 'NNY 2026-27 Yaz tatili' },
  // TODO: Erciyes ve Kayseri Üniversitesi 2026-27 tatil tarihleri netleşince ekle
];

export const UNIVERSITY_EXAM_WEEK_RANGES: readonly DateRange[] = [
  // 2024-25
  { start: '2025-01-06', end: '2025-01-17', label: '2024-25 Güz finali' },
  { start: '2025-04-07', end: '2025-04-18', label: '2024-25 Bahar midtermi' },
  { start: '2025-06-02', end: '2025-06-20', label: '2024-25 Bahar finali' },
  // 2025-26 — ERÜ (doğrulanmış JSON)
  { start: '2025-11-08', end: '2025-11-16', label: 'ERÜ 2025-26 Güz ara sınavları' },
  { start: '2025-12-29', end: '2026-01-11', label: 'KÜ 2025-26 Güz yarıyıl sonu' },
  { start: '2026-01-05', end: '2026-02-01', label: 'ERÜ 2025-26 Güz dönem sonu + bütünleme' },
  { start: '2026-01-19', end: '2026-01-25', label: 'KÜ 2025-26 Güz bütünleme' },
  { start: '2026-04-11', end: '2026-04-19', label: 'ERÜ 2025-26 Bahar ara sınavları' },
  { start: '2026-06-08', end: '2026-06-21', label: 'KÜ 2025-26 Bahar yarıyıl sonu' },
  { start: '2026-06-15', end: '2026-07-12', label: 'ERÜ 2025-26 Bahar dönem sonu + bütünleme' },
  { start: '2026-06-29', end: '2026-07-05', label: 'KÜ 2025-26 Bahar bütünleme' },
  // 2026-27 — NNY (doğrulanmış JSON)
  { start: '2026-12-28', end: '2027-01-15', label: 'NNY 2026-27 Güz finali' },
  { start: '2027-01-25', end: '2027-02-05', label: 'NNY 2026-27 Güz bütünleme' },
  { start: '2027-06-07', end: '2027-06-25', label: 'NNY 2026-27 Bahar finali' },
  { start: '2027-06-28', end: '2027-07-09', label: 'NNY 2026-27 Bahar bütünleme' },
  // TODO: Kayseri Üniversitesi ve Erciyes 2026-27 sınav haftaları netleşince ekle
];

// ── Üniversite bazlı akademik takvim yapısı ──────────────────────────────────

export type UniversityEventType =
  | 'TERM'
  | 'REGISTRATION'
  | 'ADD_DROP'
  | 'MIDTERM'
  | 'FINALS'
  | 'MAKEUP'
  | 'BREAK';

export type UniversityId = 'ERCIYES' | 'KAYSERI' | 'NNY';

export type UniversityCalendarEntry = {
  readonly type: UniversityEventType;
  readonly start: string;
  readonly end: string;
  readonly label?: string;
  readonly source: UniversityId;
  readonly sourceYear: string;
  readonly verified: true;
};

export type UniversityCalendar = {
  readonly universityId: UniversityId;
  readonly universityName: string;
  readonly stationGroupId: string;
  readonly entries: readonly UniversityCalendarEntry[];
};

// ── Erciyes Üniversitesi 2025-2026 ───────────────────────────────────────────
// Kaynak: erciyes.edu.tr akademik takvim (doğrulanmış JSON)

export const ERCIYES_UNIVERSITY_CALENDAR: UniversityCalendar = {
  universityId: 'ERCIYES',
  universityName: 'Erciyes Üniversitesi',
  stationGroupId: '1006048',
  entries: [
    // ── Güz Dönemi 2025-2026 ──────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2025-09-08', end: '2025-09-16', label: 'Güz Dönemi Kayıt Yenileme',           source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'TERM',         start: '2025-09-15', end: '2026-01-02', label: 'Güz Dönemi',                          source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'MIDTERM',      start: '2025-11-08', end: '2025-11-16', label: 'Ara Sınavlar',                        source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'FINALS',       start: '2026-01-05', end: '2026-02-01', label: 'Dönem Sonu ve Bütünleme Sınavları',   source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    // ── Bahar Dönemi 2025-2026 ────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2026-02-09', end: '2026-02-17', label: 'Bahar Dönemi Kayıt Yenileme',         source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'TERM',         start: '2026-02-16', end: '2026-06-12', label: 'Bahar Dönemi',                        source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'MIDTERM',      start: '2026-04-11', end: '2026-04-19', label: 'Ara Sınavlar',                        source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
    { type: 'FINALS',       start: '2026-06-15', end: '2026-07-12', label: 'Dönem Sonu ve Bütünleme Sınavları',   source: 'ERCIYES', sourceYear: '2025-2026', verified: true },
  ],
};

// ── Kayseri Üniversitesi 2025-2026 ───────────────────────────────────────────
// Kaynak: kayseri.edu.tr akademik takvim (doğrulanmış JSON)

export const KAYSERI_UNIVERSITY_CALENDAR: UniversityCalendar = {
  universityId: 'KAYSERI',
  universityName: 'Kayseri Üniversitesi',
  stationGroupId: '1006071',
  entries: [
    // ── Güz Dönemi 2025-2026 ──────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2025-09-08', end: '2025-09-16', label: 'Güz Dönemi Ders Kayıtları',      source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'TERM',         start: '2025-09-15', end: '2025-12-26', label: 'Güz Dönemi',                     source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'FINALS',       start: '2025-12-29', end: '2026-01-11', label: 'Yarıyıl Sonu Sınavları',         source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'MAKEUP',       start: '2026-01-19', end: '2026-01-25', label: 'Bütünleme Sınavları',            source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    // ── Bahar Dönemi 2025-2026 ────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2026-02-09', end: '2026-02-17', label: 'Bahar Dönemi Ders Kayıtları',    source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'TERM',         start: '2026-02-16', end: '2026-06-05', label: 'Bahar Dönemi',                   source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'FINALS',       start: '2026-06-08', end: '2026-06-21', label: 'Yarıyıl Sonu Sınavları',         source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    { type: 'MAKEUP',       start: '2026-06-29', end: '2026-07-05', label: 'Bütünleme Sınavları',            source: 'KAYSERI', sourceYear: '2025-2026', verified: true },
    // TODO: Kayseri Üniversitesi 2026-2027 akademik takvimi yayımlandığında ekle
  ],
};

// ── Nuh Naci Yazgan Üniversitesi 2026-2027 ───────────────────────────────────
// Kaynak: nny.edu.tr akademik takvim (doğrulanmış JSON)

export const NNY_UNIVERSITY_CALENDAR: UniversityCalendar = {
  universityId: 'NNY',
  universityName: 'Nuh Naci Yazgan Üniversitesi',
  stationGroupId: '1006063',
  entries: [
    // ── Güz Dönemi 2026-2027 ──────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2026-09-07', end: '2026-09-15', label: 'Güz Yarıyılı Ders Kayıtları',          source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'TERM',         start: '2026-09-14', end: '2026-12-25', label: 'Güz Yarıyılı',                          source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'FINALS',       start: '2026-12-28', end: '2027-01-15', label: 'Güz Yarıyılı Sonu Sınavları',           source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'MAKEUP',       start: '2027-01-25', end: '2027-02-05', label: 'Güz Yarıyılı Bütünleme Sınavları',      source: 'NNY', sourceYear: '2026-2027', verified: true },
    // ── Bahar Dönemi 2026-2027 ────────────────────────────────────────────
    { type: 'REGISTRATION', start: '2027-02-08', end: '2027-02-16', label: 'Bahar Yarıyılı Ders Kayıtları',         source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'TERM',         start: '2027-02-15', end: '2027-06-04', label: 'Bahar Yarıyılı',                         source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'FINALS',       start: '2027-06-07', end: '2027-06-25', label: 'Bahar Yarıyılı Sonu Sınavları',          source: 'NNY', sourceYear: '2026-2027', verified: true },
    { type: 'MAKEUP',       start: '2027-06-28', end: '2027-07-09', label: 'Bahar Yarıyılı Bütünleme Sınavları',     source: 'NNY', sourceYear: '2026-2027', verified: true },
    // TODO: NNY 2025-2026 akademik takvimi eklenecek
  ],
};

// ── Birleşik erişim ───────────────────────────────────────────────────────────

export const UNIVERSITY_CALENDARS: readonly UniversityCalendar[] = [
  ERCIYES_UNIVERSITY_CALENDAR,
  KAYSERI_UNIVERSITY_CALENDAR,
  NNY_UNIVERSITY_CALENDAR,
];
