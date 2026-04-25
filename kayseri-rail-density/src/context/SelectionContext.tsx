import React, { createContext, useContext, useMemo, useState } from 'react';
import passengerRaw from '../../assets/data/passengerData.json';
import type { PassengerRow, StationRecord } from '../types';
import { defaultSelection, uniqueSortedDates } from '../utils/date';
import { buildMergedStations } from '../utils/stations';

type SelectionContextValue = {
  passengerRows: PassengerRow[];
  stations: StationRecord[];
  sortedDates: string[];
  tarih: string;
  saat: number;
  setTarih: (d: string) => void;
  setSaat: (h: number) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const passengerRows = passengerRaw as PassengerRow[];
  const stations = useMemo(() => buildMergedStations(passengerRows), [passengerRows]);
  const sortedDates = useMemo(() => uniqueSortedDates(passengerRows), [passengerRows]);
  const init = useMemo(() => defaultSelection(passengerRows), [passengerRows]);
  const [tarih, setTarih] = useState(init.tarih);
  const [saat, setSaat] = useState(init.saat);

  const value = useMemo(
    () => ({
      passengerRows,
      stations,
      sortedDates,
      tarih,
      saat,
      setTarih,
      setSaat,
    }),
    [passengerRows, stations, sortedDates, tarih, saat]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
