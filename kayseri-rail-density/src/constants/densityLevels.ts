export type DensityLevel =
  | 'Seyrek'
  | 'Çok Düşük'
  | 'Düşük'
  | 'Orta'
  | 'Yüksek'
  | 'Çok Yüksek'
  | 'Kapasite Aşımı';

export const TRAM_CAPACITY = 350;

export const DENSITY_LEVELS = [
  {
    key: 'sparse',
    label: 'Seyrek',
    min: 0,
    max: 20,
    color: '#FFF3C4',
  },
  {
    key: 'veryLow',
    label: 'Çok Düşük',
    min: 21,
    max: 50,
    color: '#FDE0C5',
  },
  {
    key: 'low',
    label: 'Düşük',
    min: 51,
    max: 100,
    color: '#F8B985',
  },
  {
    key: 'medium',
    label: 'Orta',
    min: 101,
    max: 150,
    color: '#F28A3D',
  },
  {
    key: 'high',
    label: 'Yüksek',
    min: 151,
    max: 250,
    color: '#D95F0E',
  },
  {
    key: 'veryHigh',
    label: 'Çok Yüksek',
    min: 251,
    max: 350,
    color: '#8C2D04',
  },
  {
    key: 'overCapacity',
    label: 'Kapasite Aşımı',
    min: 351,
    max: Infinity,
    color: '#000000',
  },
] as const;

export type DensityLevelInfo = (typeof DENSITY_LEVELS)[number];

export function formatDensityRange(level: DensityLevelInfo): string {
  if (level.key === 'overCapacity' || !Number.isFinite(level.max)) return '351+';
  return `${level.min}-${level.max}`;
}

export function getDensityLevel(passengerCount: number): DensityLevelInfo {
  const count = Math.max(0, Number(passengerCount) || 0);

  return (
    DENSITY_LEVELS.find((level) => count >= level.min && count <= level.max) ?? DENSITY_LEVELS[0]
  );
}
