import type { PassengerRow } from '../types';

export function uniqueSortedDates(rows: PassengerRow[]): string[] {
  const s = new Set(rows.map((r) => r.tarih));
  return [...s].sort();
}

export function defaultSelection(rows: PassengerRow[]): { tarih: string; saat: number } {
  const dates = uniqueSortedDates(rows);
  const tarih = dates[dates.length - 1] ?? '2025-01-01';
  const hours = rows.filter((r) => r.tarih === tarih).map((r) => r.saat);
  const saat = hours.length ? Math.min(...hours) : 8;
  return { tarih, saat };
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
