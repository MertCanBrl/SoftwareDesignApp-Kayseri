import { getDensityLevel, type DensityLevel } from '../constants/densityLevels';
import type { DisplayPassengerRow } from '../types';

const DENSITY_ORDER: Record<DensityLevel, number> = {
  Seyrek: 1,
  'Çok Düşük': 2,
  Düşük: 3,
  Orta: 4,
  Yüksek: 5,
  'Çok Yüksek': 6,
  'Kapasite Aşımı': 7,
};

function densityRank(label: string): number {
  return DENSITY_ORDER[label as DensityLevel] ?? 1;
}

function isHighDensityLabel(label: string): boolean {
  return densityRank(label) >= 5;
}

export type HourlySnapshot = {
  hour: number;
  passengerCount: number;
  densityLabel: string;
};

export type GoRecommendation = {
  current?: HourlySnapshot;
  next?: HourlySnapshot;
  message: string;
};

export type TrendPoint = {
  hour: string;
  /** Kayıt yoksa `null` (eksik saat). Gerçek 0 yolcu ile karışmaz. */
  passengerCount: number | null;
  densityLabel: string;
};

function toSnapshot(saat: number, yolcuSayisi: number): HourlySnapshot {
  const d = getDensityLevel(yolcuSayisi);
  return { hour: saat, passengerCount: yolcuSayisi, densityLabel: d.label };
}

/**
 * Seçili günün tüm saatlerinden ilgili durağın kayıtları (saat artan sırada).
 */
export function getStationHourlyRows(
  rows: DisplayPassengerRow[],
  durakId: string
): DisplayPassengerRow[] {
  return rows
    .filter((r) => r.durakId === durakId)
    .sort((a, b) => a.saat - b.saat);
}

type BestHourResult = { hour: number; passengerCount: number; densityLabel: string };

function bestInRange(
  list: ReturnType<typeof getStationHourlyRows>,
  min: number,
  max: number
): BestHourResult | null {
  const candidates = list.filter((r) => r.saat >= min && r.saat <= max);
  if (!candidates.length) return null;
  let best = candidates[0]!;
  for (const r of candidates) {
    if (r.yolcuSayisi < best.yolcuSayisi) best = r;
    else if (r.yolcuSayisi === best.yolcuSayisi && r.saat < best.saat) best = r;
  }
  return { hour: best.saat, passengerCount: best.yolcuSayisi, densityLabel: getDensityLevel(best.yolcuSayisi).label };
}

/**
 * En düşük yolcu sayısına sahip saat; yoksa null.
 * Eşitlikte en erken saat. (getCurrentAndNextRecommendation tarafından kullanılır)
 */
export function getBestHourForStation(
  rows: DisplayPassengerRow[],
  durakId: string
): BestHourResult | null {
  const list = getStationHourlyRows(rows, durakId);
  if (!list.length) return null;
  return bestInRange(list, 0, 23);
}

export type PeriodBestHours = {
  sabah: BestHourResult | null;   // 06:00–11:00
  oglen: BestHourResult | null;   // 12:00–16:00
  aksam: BestHourResult | null;   // 17:00–22:00
};

/**
 * Sabah (06-11), öğlen (12-16) ve akşam (17-22) dilimlerinde en sakin saati döner.
 */
export function getBestHoursByPeriod(
  rows: DisplayPassengerRow[],
  durakId: string
): PeriodBestHours {
  const list = getStationHourlyRows(rows, durakId);
  return {
    sabah: bestInRange(list, 6, 11),
    oglen: bestInRange(list, 12, 16),
    aksam: bestInRange(list, 17, 22),
  };
}

/**
 * "Şu an / sonraki saat" önerisi. Kurallar kullanıcı spesifikasyonundaki öncelik sırasıyla.
 */
export function getCurrentAndNextRecommendation(
  rows: DisplayPassengerRow[],
  durakId: string,
  currentHour: number
): GoRecommendation {
  const list = getStationHourlyRows(rows, durakId);
  if (!list.length) {
    return { message: 'Bu saat için yeterli veri yok' };
  }

  const byHour = new Map<number, DisplayPassengerRow>();
  for (const r of list) byHour.set(r.saat, r);

  const curRow = byHour.get(currentHour);
  const nextRow = byHour.get(currentHour + 1);

  const current = curRow ? toSnapshot(curRow.saat, curRow.yolcuSayisi) : undefined;
  const next = nextRow ? toSnapshot(nextRow.saat, nextRow.yolcuSayisi) : undefined;

  if (!curRow) {
    return {
      current,
      next,
      message: 'Bu saat için yeterli veri yok',
    };
  }

  const best = getBestHourForStation(rows, durakId);
  const curLabel = getDensityLevel(curRow.yolcuSayisi).label;
  const curRank = densityRank(curLabel);

  if (curRank <= densityRank('Düşük')) {
    return { current, next, message: 'Şu an gitmek uygun' };
  }

  if (nextRow && nextRow.yolcuSayisi < curRow.yolcuSayisi) {
    return { current, next, message: 'Bir sonraki saat daha uygun' };
  }

  if (best && best.hour !== currentHour) {
    const h = String(best.hour).padStart(2, '0');
    return { current, next, message: `En sakin saat: ${h}:00` };
  }

  if (
    isHighDensityLabel(curLabel) &&
    nextRow &&
    isHighDensityLabel(getDensityLevel(nextRow.yolcuSayisi).label)
  ) {
    return { current, next, message: 'Bu saat aralığı yoğun görünüyor' };
  }

  return { current, next, message: 'Bu saat aralığı yoğun görünüyor' };
}

const TREND_HOURS: readonly number[] = [
  5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];

const MISSING_DENSITY = 'Veri yok' as const;

/**
 * 05:00–23:00 ızgarası. Saat dosyada yoksa yolcu `null` ve yoğunluk "Veri yok";
 * dosyada 0 yolcu varsa `0` ve gerçek yoğunluk (ör. Seyrek).
 */
export function getHourlyTrendData(rows: DisplayPassengerRow[], durakId: string): TrendPoint[] {
  const byHour = new Map<number, number>();
  for (const r of getStationHourlyRows(rows, durakId)) {
    byHour.set(r.saat, r.yolcuSayisi);
  }
  return TREND_HOURS.map((h) => {
    if (byHour.has(h)) {
      const passengerCount = byHour.get(h)!;
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        passengerCount,
        densityLabel: getDensityLevel(passengerCount).label,
      };
    }
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      passengerCount: null,
      densityLabel: MISSING_DENSITY,
    };
  });
}

/**
 * `react-native-chart-kit` sayı dışı (null) desteklemediği için: yalnızca kaydı olan saatler.
 */
export function getHourlyTrendDataChartSeries(
  trend: TrendPoint[]
): { labels: string[]; data: number[]; hourKeys: number[] } {
  const withVal: { h: number; v: number; label: string }[] = [];
  for (const t of trend) {
    if (t.passengerCount === null) continue;
    const m = t.hour.match(/^(\d{2}):/);
    const hour = m ? parseInt(m[1]!, 10) : 0;
    withVal.push({ h: hour, v: t.passengerCount, label: t.hour.slice(0, 2) });
  }
  return {
    labels: withVal.map((x) => x.label),
    data: withVal.map((x) => x.v),
    hourKeys: withVal.map((x) => x.h),
  };
}

/**
 * Harita callout: tek kısa satır.
 */
export function getMapCalloutShortRecommendation(
  rows: DisplayPassengerRow[],
  durakId: string,
  currentHour: number
): string | null {
  const list = getStationHourlyRows(rows, durakId);
  if (!list.length) return null;

  const rec = getCurrentAndNextRecommendation(rows, durakId, currentHour);
  if (rec.message === 'Bu saat için yeterli veri yok') {
    return null;
  }
  if (rec.message === 'Şu an gitmek uygun') {
    return 'Öneri: Şu an gitmek uygun';
  }
  if (rec.message === 'Bir sonraki saat daha uygun') {
    return 'Öneri: Sonraki saat daha uygun';
  }
  const sakinFromRec = rec.message.match(/^En sakin saat: (\d{2}):00$/);
  if (sakinFromRec) {
    return `Öneri: En sakin saat ${sakinFromRec[1]}:00`;
  }
  if (rec.message === 'Bu saat aralığı yoğun görünüyor') {
    return 'Öneri: Saat aralığı yoğun';
  }
  const best = getBestHourForStation(rows, durakId);
  if (best) {
    return `Öneri: En sakin saat ${String(best.hour).padStart(2, '0')}:00`;
  }
  return null;
}
