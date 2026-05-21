import type { ContextImpactLevel } from './contextTypes';

const IMPACT_RANK: Record<ContextImpactLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export function parseYmd(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function isWeekendDate(date: string): boolean {
  const parsed = parseYmd(date);
  if (!parsed) return false;
  const day = parsed.getDay();
  return day === 0 || day === 6;
}

export function isDateInRange(date: string, range: { start: string; end: string }): boolean {
  return date >= range.start && date <= range.end;
}

export function isDateInAnyRange(
  date: string,
  ranges: readonly { start: string; end: string }[]
): boolean {
  return ranges.some((r) => isDateInRange(date, r));
}

export function isDateInList(date: string, list: readonly string[]): boolean {
  return list.includes(date);
}

export function maxImpactLevel(
  ...levels: readonly ContextImpactLevel[]
): ContextImpactLevel {
  let best: ContextImpactLevel = 'NONE';
  for (const level of levels) {
    if (IMPACT_RANK[level] > IMPACT_RANK[best]) best = level;
  }
  return best;
}

export function eventActiveAtHour(
  event: { date: string; startHour: number; endHour: number },
  date: string,
  hour: number
): boolean {
  if (event.date !== date) return false;
  return hour >= event.startHour && hour <= event.endHour;
}
