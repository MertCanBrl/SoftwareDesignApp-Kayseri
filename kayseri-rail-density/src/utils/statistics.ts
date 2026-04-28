import { getCanonicalDurakAd } from '../constants/durakCanonicalMap';
import type { DisplayPassengerRow, HourlyPoint } from '../types';

/** Context’ten gelen satırlar (dataType + isteğe bağlı tahmin güveni) */
type CountRow = DisplayPassengerRow;

export function getPassengerCountByStationDateHour(
  rows: CountRow[],
  durakId: string,
  tarih: string,
  saat: number
): number | null {
  const hit = getPassengerRowByStationDateHour(rows, durakId, tarih, saat);
  return hit ? hit.yolcuSayisi : null;
}

export function getPassengerRowByStationDateHour(
  rows: CountRow[],
  durakId: string,
  tarih: string,
  saat: number
): CountRow | null {
  const hit = rows.find((r) => r.durakId === durakId && r.tarih === tarih && r.saat === saat);
  return hit ?? null;
}

export function getDailyStationData(rows: CountRow[], durakId: string, tarih: string): HourlyPoint[] {
  const list = rows
    .filter((r) => r.durakId === durakId && r.tarih === tarih)
    .map((r) => ({ saat: r.saat, yolcuSayisi: r.yolcuSayisi }))
    .sort((a, b) => a.saat - b.saat);
  return list;
}

export function getBusiestHour(points: HourlyPoint[]): number | null {
  if (!points.length) return null;
  let best = points[0].saat;
  let bestVal = points[0].yolcuSayisi;
  for (const p of points) {
    if (p.yolcuSayisi > bestVal) {
      bestVal = p.yolcuSayisi;
      best = p.saat;
    }
  }
  return best;
}

export function stationDailyTotals(rows: CountRow[], tarih: string): Map<string, { durakAd: string; total: number }> {
  const m = new Map<string, { durakAd: string; total: number }>();
  for (const r of rows) {
    if (r.tarih !== tarih) continue;
    const ad = getCanonicalDurakAd(r.durakId, r.durakAd);
    const cur = m.get(r.durakId);
    if (cur) {
      cur.total += r.yolcuSayisi;
      cur.durakAd = ad;
    } else m.set(r.durakId, { durakAd: ad, total: r.yolcuSayisi });
  }
  return m;
}

export function getTopStations(
  rows: CountRow[],
  tarih: string,
  limit: number
): { durakId: string; durakAd: string; total: number }[] {
  const m = stationDailyTotals(rows, tarih);
  return [...m.entries()]
    .map(([durakId, v]) => ({ durakId, durakAd: v.durakAd, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type DailySummary = {
  totalPassengers: number;
  busiestStation: { durakId: string; durakAd: string; total: number } | null;
  calmestStation: { durakId: string; durakAd: string; total: number } | null;
  busiestHour: number | null;
  averagePerRecord: number;
  top5: { durakId: string; durakAd: string; total: number }[];
};

export function getDailySummary(rows: CountRow[], tarih: string): DailySummary {
  const dayRows = rows.filter((r) => r.tarih === tarih);
  const totalPassengers = dayRows.reduce((s, r) => s + r.yolcuSayisi, 0);
  const byStation = stationDailyTotals(rows, tarih);
  let busiest: { durakId: string; durakAd: string; total: number } | null = null;
  let calmest: { durakId: string; durakAd: string; total: number } | null = null;
  for (const [durakId, v] of byStation) {
    const item = { durakId, durakAd: v.durakAd, total: v.total };
    if (!busiest || v.total > busiest.total) busiest = item;
    if (!calmest || v.total < calmest.total) calmest = item;
  }

  const hourTotals = new Map<number, number>();
  for (const r of dayRows) {
    hourTotals.set(r.saat, (hourTotals.get(r.saat) ?? 0) + r.yolcuSayisi);
  }
  let busiestHour: number | null = null;
  let maxH = -1;
  for (const [h, t] of hourTotals) {
    if (t > maxH) {
      maxH = t;
      busiestHour = h;
    }
  }

  const averagePerRecord = dayRows.length ? totalPassengers / dayRows.length : 0;
  const top5 = getTopStations(rows, tarih, 5);

  return {
    totalPassengers,
    busiestStation: busiest,
    calmestStation: calmest,
    busiestHour,
    averagePerRecord,
    top5,
  };
}
