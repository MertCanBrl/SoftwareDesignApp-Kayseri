import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import passengerDatesJson from '../../assets/data/passengerDates.json';
import predictionDatesJson from '../../assets/data/predictionDates.json';
import type { DisplayPassengerRow, PassengerRow, PredictionFileRow, StationRecord } from '../types';
import { buildMergedStations } from '../utils/stations';
import { passengerDataLoaders } from '../generated/passengerDataIndex';
import { predictionDataLoaders } from '../generated/predictionDataIndex';

const passengerDateList: string[] = (passengerDatesJson as string[]).filter(
  (d): d is string => typeof d === 'string' && d.length > 0
);
const predictionDateList: string[] = (predictionDatesJson as string[]).filter(
  (d): d is string => typeof d === 'string' && d.length > 0
);

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mergeUniqueSorted(dates: string[], more: string[]): string[] {
  return [...new Set([...dates, ...more])].sort();
}

type DateDataKind = 'actual' | 'prediction' | 'none';

type SelectionContextValue = {
  /** Seçili günün satırları (gerçek veya tahmin, dataType ile ayrılmış) */
  passengerRows: DisplayPassengerRow[];
  stations: StationRecord[];
  /** Takvim: geçmiş + tahmin, sıralı */
  sortedDates: string[];
  tarih: string;
  saat: number;
  setTarih: (d: string) => void;
  setSaat: (h: number) => void;
  dateDataKind: DateDataKind;
  /** Sadece tahmin; takvimde mavi nokta için (gerçek günler hariç) */
  markPredictionOnlyDates: string[];
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function initialTarih(merged: string[], actualLast: string[], pred: string[]): string {
  const todayStr = localTodayYmd();
  if (pred.includes(todayStr)) {
    return todayStr;
  }
  if (actualLast.length) {
    return actualLast[actualLast.length - 1]!;
  }
  if (pred.length) {
    return pred[0]!;
  }
  if (merged.length) {
    return merged[merged.length - 1]!;
  }
  return '2025-01-01';
}

function loadRowsForTarih(t: string): DisplayPassengerRow[] {
  const pLoad = (passengerDataLoaders as Record<string, (() => PassengerRow[]) | undefined>)[t];
  if (pLoad) {
    return pLoad().map((r) => ({ ...r, dataType: 'actual' as const }));
  }
  const prLoad = (predictionDataLoaders as Record<string, (() => PredictionFileRow[]) | undefined>)[t];
  if (prLoad) {
    return prLoad().map((r) => ({
      tarih: r.date,
      durakId: r.durakId,
      durakAd: r.durakAd,
      saat: r.hour,
      yolcuSayisi: r.predictedPassengerCount,
      dataType: 'prediction' as const,
    }));
  }
  return [];
}

function saatForRows(rows: DisplayPassengerRow[]): number {
  if (!rows.length) return 0;
  return Math.min(...rows.map((r) => r.saat));
}

function dateDataKindForRows(rows: DisplayPassengerRow[]): DateDataKind {
  if (!rows.length) return 'none';
  return rows[0]!.dataType;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const mergedSorted = useMemo(
    () => mergeUniqueSorted(passengerDateList, predictionDateList),
    []
  );
  const markPredictionOnly = useMemo(() => {
    const actual = new Set(passengerDateList);
    return predictionDateList.filter((d) => !actual.has(d));
  }, []);

  const stations = useMemo(() => buildMergedStations([]), []);
  const sortedDates = useMemo(() => [...mergedSorted], [mergedSorted]);
  const startT = initialTarih(mergedSorted, passengerDateList, predictionDateList);
  const [tarih, setTarih] = useState<string>(startT);
  const [passengerRows, setPassengerRows] = useState<DisplayPassengerRow[]>(() =>
    loadRowsForTarih(startT)
  );
  const [saat, setSaat] = useState(() => saatForRows(loadRowsForTarih(startT)));

  const dateDataKind = useMemo(() => dateDataKindForRows(passengerRows), [passengerRows]);

  useEffect(() => {
    const rows = loadRowsForTarih(tarih);
    setPassengerRows(rows);
    setSaat(saatForRows(rows));
  }, [tarih]);

  const value = useMemo(
    () => ({
      passengerRows,
      stations,
      sortedDates,
      tarih,
      saat,
      setTarih,
      setSaat,
      dateDataKind,
      markPredictionOnlyDates: markPredictionOnly,
    }),
    [passengerRows, stations, sortedDates, tarih, saat, dateDataKind, markPredictionOnly]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
