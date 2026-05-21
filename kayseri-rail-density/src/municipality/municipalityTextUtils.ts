export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatOccupancyPercent(occupancyRate: number): string {
  return (occupancyRate * 100).toFixed(0);
}

export function formatSegmentLabel(fromStationName: string, toStationName: string): string {
  return `${fromStationName} → ${toStationName}`;
}
