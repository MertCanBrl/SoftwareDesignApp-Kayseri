import type { StationDirection } from './transitNetworkTypes';

/**
 * Aktarma durakları — manuel liste.
 * Gerçek hat bağlantıları netleşince bu dosyayı güncelleyin.
 */
export type TransferStationOverride = {
  stationGroupId: string;
  isTransferStation: boolean;
  connectedLines: readonly string[];
  transferWeight: number;
  possibleDirections: readonly StationDirection[];
  notes?: string;
};

export const TRANSFER_STATION_OVERRIDES: readonly TransferStationOverride[] = [
  {
    stationGroupId: '1006019',
    isTransferStation: true,
    connectedLines: ['kayseri-tram-t1'],
    transferWeight: 0.85,
    possibleDirections: ['directionA', 'directionB'],
    notes: 'Cumhuriyet Meydanı — merkez aktarma potansiyeli (örnek).',
  },
  {
    stationGroupId: '1006028',
    isTransferStation: true,
    connectedLines: ['kayseri-tram-t1'],
    transferWeight: 0.9,
    possibleDirections: ['directionA', 'directionB'],
    notes: 'Doğu Terminali — hat ucu / aktarma (örnek).',
  },
  {
    stationGroupId: '1006057',
    isTransferStation: true,
    connectedLines: ['kayseri-tram-t1'],
    transferWeight: 0.75,
    possibleDirections: ['directionA', 'directionB'],
    notes: 'Otogar — otobüs-tramvay aktarma adayı (örnek).',
  },
  {
    stationGroupId: '1006048',
    isTransferStation: false,
    connectedLines: ['kayseri-tram-t1'],
    transferWeight: 0.4,
    possibleDirections: ['directionA', 'directionB'],
    notes: 'Erciyes Üniversitesi — yoğun biniş/iniş, düşük ağırlıklı örnek.',
  },
] as const;

const overrideByStationGroupId = new Map(
  TRANSFER_STATION_OVERRIDES.map((o) => [o.stationGroupId, o] as const)
);

export function getTransferStationOverride(
  stationGroupId: string
): TransferStationOverride | undefined {
  return overrideByStationGroupId.get(stationGroupId);
}
