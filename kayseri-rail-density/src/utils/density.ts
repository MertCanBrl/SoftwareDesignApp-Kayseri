import type { DensityLevel, QuartileThresholds } from '../types';

const STOPS = [
  { t: 0, r: 34, g: 197, b: 94 },
  { t: 0.33, r: 250, g: 204, b: 21 },
  { t: 0.66, r: 249, g: 115, b: 22 },
  { t: 1, r: 239, g: 68, b: 68 },
] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgbAtGlobalT(globalT: number): { r: number; g: number; b: number } {
  const t = Math.min(1, Math.max(0, globalT));
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return {
        r: Math.round(lerp(a.r, b.r, local)),
        g: Math.round(lerp(a.g, b.g, local)),
        b: Math.round(lerp(a.b, b.b, local)),
      };
    }
  }
  const last = STOPS[STOPS.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

/** Seçilen dilimdeki tüm yolcu sayılarından Q1–Q3 eşikleri (dahil dilim). */
export function calculatePercentiles(counts: number[]): QuartileThresholds | null {
  const vals = counts.filter((n) => Number.isFinite(n)).map((n) => Math.max(0, n));
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const pick = (p: number) => {
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return { q1: pick(0.25), q2: pick(0.5), q3: pick(0.75) };
}

export function getDensityLevel(value: number, qs: QuartileThresholds): DensityLevel {
  if (value <= qs.q1) return 'low';
  if (value <= qs.q2) return 'medium';
  if (value <= qs.q3) return 'high';
  return 'very_high';
}

/** 0–1 arası yüzdelik konuma göre yeşil→sarı→turuncu→kırmızı interpolasyon. */
export function getDensityColor(percentile01: number): string {
  const { r, g, b } = rgbAtGlobalT(percentile01);
  return `rgb(${r},${g},${b})`;
}

export function getDensityLabel(level: DensityLevel): string {
  switch (level) {
    case 'low':
      return 'Düşük';
    case 'medium':
      return 'Orta';
    case 'high':
      return 'Yüksek';
    case 'very_high':
      return 'Çok yüksek';
    default:
      return '—';
  }
}

/** Değerin dilim içindeki yüzdelik sırası (0–1), eş değerler için ortalama sıra. */
export function percentileRank01(value: number, sortedCounts: number[]): number {
  if (!sortedCounts.length) return 0;
  const sorted = [...sortedCounts].sort((a, b) => a - b);
  const n = sorted.length;
  let le = 0;
  for (let i = 0; i < n; i += 1) {
    if (sorted[i] <= value) le += 1;
  }
  if (n === 1) return 0.5;
  return Math.min(1, Math.max(0, (le - 0.5) / (n - 1)));
}
