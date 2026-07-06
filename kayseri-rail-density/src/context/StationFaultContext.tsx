import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { StationFault } from '../types';

type StationFaultContextValue = {
  faults: StationFault[];
  getFault: (parentDurakId: string) => StationFault | undefined;
  reportFault: (parentDurakId: string, durakAd: string, description: string) => void;
  clearFault: (parentDurakId: string) => void;
};

const StationFaultContext = createContext<StationFaultContextValue | null>(null);

export function StationFaultProvider({ children }: { children: React.ReactNode }) {
  const [faultsMap, setFaultsMap] = useState<Record<string, StationFault>>({});

  const reportFault = useCallback(
    (parentDurakId: string, durakAd: string, description: string) => {
      setFaultsMap((prev) => ({
        ...prev,
        [parentDurakId]: {
          parentDurakId,
          durakAd,
          description,
          reportedAt: new Date().toISOString(),
        },
      }));
    },
    []
  );

  const clearFault = useCallback((parentDurakId: string) => {
    setFaultsMap((prev) => {
      if (!(parentDurakId in prev)) return prev;
      const next = { ...prev };
      delete next[parentDurakId];
      return next;
    });
  }, []);

  const getFault = useCallback(
    (parentDurakId: string) => faultsMap[parentDurakId],
    [faultsMap]
  );

  const faults = useMemo(
    () => Object.values(faultsMap).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    [faultsMap]
  );

  const value = useMemo<StationFaultContextValue>(
    () => ({ faults, getFault, reportFault, clearFault }),
    [faults, getFault, reportFault, clearFault]
  );

  return <StationFaultContext.Provider value={value}>{children}</StationFaultContext.Provider>;
}

export function useStationFaults(): StationFaultContextValue {
  const ctx = useContext(StationFaultContext);
  if (!ctx) throw new Error('useStationFaults must be used within StationFaultProvider');
  return ctx;
}
