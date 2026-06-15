export type TramDayType = 'weekday' | 'saturday' | 'sunday';

export type TramDirection = 'gidis' | 'donus';

export type TramLineSchedule = {
  direction: TramDirection;
  fromStation: string;
  fromStationId: string;
  toStation: string;
  toStationId: string;
  /** Departure times per day type (HH:MM strings). */
  schedule: Record<TramDayType, readonly string[]>;
};

export type TramLine = {
  lineId: string;
  lineName: string;
  departures: readonly [TramLineSchedule, TramLineSchedule];
};

export type TramScheduleData = {
  version: string;
  lastUpdated: string;
  lines: Record<string, TramLine>;
};

export type NextDeparture = {
  lineId: string;
  direction: TramDirection;
  fromStation: string;
  toStation: string;
  departureTime: string;
  minutesUntilDeparture: number;
};
