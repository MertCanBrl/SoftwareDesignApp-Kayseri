import type { PassengerRow } from '../types';

/** Belirli tarih/saat için durak bazında toplam yolcu sayısı. */
export function aggregatePassengerCountsByStation(
  rows: readonly PassengerRow[],
  date: string,
  hour: number
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.tarih !== date || row.saat !== hour) continue;
    const stationId = String(row.durakId);
    totals.set(stationId, (totals.get(stationId) ?? 0) + row.yolcuSayisi);
  }

  return totals;
}
