import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import passengerDatesJson from '../../assets/data/passengerDates.json';
import predictionDatesJson from '../../assets/data/predictionDates.json';
import type { DisplayPassengerRow, PassengerRow, PredictionFileRow, StationRecord } from '../types';
import { buildMergedStations } from '../utils/stations';
import { passengerDataLoaders } from '../generated/passengerDataIndex';
import { predictionDataLoaders } from '../generated/predictionDataIndex';
import { useAuth } from '../auth/AuthContext';
import { GUEST_FUTURE_DAYS } from '../auth/accessControl';
import { getPlatformType } from '../utils/platformUtils';

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

function localCurrentHour(): number {
  return new Date().getHours();
}

function addDaysToYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function mergeUniqueSorted(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

// Tüm mevcut tarihler (ham, filtresiz) — modül seviyesinde sabit
const _allMergedSorted: string[] = mergeUniqueSorted(passengerDateList, predictionDateList);

type DateDataKind = 'actual' | 'prediction' | 'none';

type SelectionContextValue = {
  /** Seçili günün satırları (gerçek veya tahmin) */
  passengerRows: DisplayPassengerRow[];
  stations: StationRecord[];
  /** Role göre filtrelenmiş tarih listesi */
  sortedDates: string[];
  tarih: string;
  saat: number;
  /** Seçili saat içindeki dakika offseti: 0, 10, 20, 30, 40 veya 50 */
  minute: number;
  /** Geçersiz tarih/saat değerlerini reddeden korumalı setter */
  setTarih: (d: string) => void;
  /** Geçersiz saat değerini reddeden korumalı setter */
  setSaat: (h: number) => void;
  setMinute: (m: number) => void;
  dateDataKind: DateDataKind;
  /** Sadece tahmin günleri (takvimde mavi nokta için) */
  markPredictionOnlyDates: string[];
  /** Seçili günde izin verilen en erken saat; admin için 0, misafir için geçerli günün saati */
  minAllowedSaat: number;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function splitRowsForPlatforms(rows: DisplayPassengerRow[]): DisplayPassengerRow[] {
  const result: DisplayPassengerRow[] = [];
  for (const row of rows) {
    if (getPlatformType(row.durakId) === 'two_separate_areas') {
      const half1 = Math.ceil(row.yolcuSayisi / 2);
      const half2 = Math.floor(row.yolcuSayisi / 2);
      result.push({ ...row, durakId: `${row.durakId}_G`, yolcuSayisi: half1 });
      result.push({ ...row, durakId: `${row.durakId}_D`, yolcuSayisi: half2 });
    } else {
      result.push(row);
    }
  }
  return result;
}

function loadRowsForTarih(t: string): DisplayPassengerRow[] {
  const pLoad = (passengerDataLoaders as Record<string, (() => PassengerRow[]) | undefined>)[t];
  if (pLoad) {
    const rows = pLoad().map((r) => ({ ...r, dataType: 'actual' as const }));
    return splitRowsForPlatforms(rows);
  }
  const prLoad = (predictionDataLoaders as Record<string, (() => PredictionFileRow[]) | undefined>)[t];
  if (prLoad) {
    const rows = prLoad().map((r) => ({
      tarih: r.date,
      durakId: r.durakId,
      durakAd: r.durakAd,
      saat: r.hour,
      yolcuSayisi: r.predictedPassengerCount,
      dataType: 'prediction' as const,
      weatherImpactScore: r.weatherImpactScore,
      weatherImpactLevel: r.weatherImpactLevel,
      mainFactors: r.mainFactors,
    }));
    return splitRowsForPlatforms(rows);
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
  const { isAdmin } = useAuth();
  const isGuest = !isAdmin;

  // ── Tarih listesi: misafir için kısıtlı pencere ───────────────────────────
  const sortedDates = useMemo<string[]>(() => {
    if (!isGuest) return _allMergedSorted;
    const today = localTodayYmd();
    const maxDay = addDaysToYmd(today, GUEST_FUTURE_DAYS);
    return _allMergedSorted.filter((d) => d >= today && d <= maxDay);
  }, [isGuest]);

  const markPredictionOnly = useMemo<string[]>(() => {
    const actual = new Set(passengerDateList);
    const raw = predictionDateList.filter((d) => !actual.has(d));
    if (!isGuest) return raw;
    const today = localTodayYmd();
    const maxDay = addDaysToYmd(today, GUEST_FUTURE_DAYS);
    return raw.filter((d) => d >= today && d <= maxDay);
  }, [isGuest]);

  const stations = useMemo(() => buildMergedStations([]), []);

  // ── Başlangıç tarihi ──────────────────────────────────────────────────────
  const [tarih, internalSetTarih] = useState<string>(() => {
    if (isGuest) {
      const today = localTodayYmd();
      const maxDay = addDaysToYmd(today, GUEST_FUTURE_DAYS);
      const window = _allMergedSorted.filter((d) => d >= today && d <= maxDay);
      return window.includes(today) ? today : (window[0] ?? today);
    }
    const todayStr = localTodayYmd();
    if (predictionDateList.includes(todayStr)) return todayStr;
    if (passengerDateList.length) return passengerDateList[passengerDateList.length - 1]!;
    if (predictionDateList.length) return predictionDateList[0]!;
    return _allMergedSorted[_allMergedSorted.length - 1] ?? '2025-01-01';
  });

  const [passengerRows, setPassengerRows] = useState<DisplayPassengerRow[]>(() =>
    loadRowsForTarih(tarih)
  );

  // ── Başlangıç saati: misafir bugün için şu anki saati kullan ─────────────
  const [saat, internalSetSaat] = useState<number>(() => {
    const rows = loadRowsForTarih(tarih);
    const rowMin = saatForRows(rows);
    if (isGuest) {
      const today = localTodayYmd();
      if (tarih === today) return Math.max(rowMin, localCurrentHour());
    }
    return rowMin;
  });

  const [minute, internalSetMinute] = useState<number>(0);

  const setMinute = useCallback((m: number) => {
    internalSetMinute(m);
  }, []);

  const dateDataKind = useMemo(() => dateDataKindForRows(passengerRows), [passengerRows]);

  // ── Seçili günde izin verilen minimum saat ────────────────────────────────
  const minAllowedSaat = useMemo<number>(() => {
    if (!isGuest) return 0;
    const today = localTodayYmd();
    return tarih === today ? localCurrentHour() : 0;
  }, [isGuest, tarih]);

  // ── Korumalı setTarih: misafir için izin verilmeyen tarihleri reddeder ────
  const setTarih = useCallback(
    (d: string) => {
      if (isGuest && !sortedDates.includes(d)) return;
      internalSetTarih(d);
    },
    [isGuest, sortedDates]
  );

  // ── Korumalı setSaat: misafir bugün için geçmiş saatleri reddeder ─────────
  const setSaat = useCallback(
    (h: number) => {
      if (isGuest) {
        const today = localTodayYmd();
        if (tarih === today && h < localCurrentHour()) return;
      }
      internalSetSaat(h);
    },
    [isGuest, tarih]
  );

  // ── Tarih değiştiğinde veriyi yükle ve saati sıfırla ──────────────────────
  useEffect(() => {
    const rows = loadRowsForTarih(tarih);
    setPassengerRows(rows);
    const rowMin = saatForRows(rows);
    const today = localTodayYmd();
    const minHour = isGuest && tarih === today ? localCurrentHour() : 0;
    internalSetSaat(Math.max(rowMin, minHour));
    internalSetMinute(0);
  }, [tarih, isGuest]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      passengerRows,
      stations,
      sortedDates,
      tarih,
      saat,
      minute,
      setTarih,
      setSaat,
      setMinute,
      dateDataKind,
      markPredictionOnlyDates: markPredictionOnly,
      minAllowedSaat,
    }),
    [
      passengerRows,
      stations,
      sortedDates,
      tarih,
      saat,
      minute,
      setTarih,
      setSaat,
      setMinute,
      dateDataKind,
      markPredictionOnly,
      minAllowedSaat,
    ]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
