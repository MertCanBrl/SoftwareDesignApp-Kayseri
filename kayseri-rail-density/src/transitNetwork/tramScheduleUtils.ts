import type { TramDayType, TramDirection, TramLine, TramLineSchedule, NextDeparture } from './tramScheduleTypes';
import scheduleData from '../../assets/data/tram-schedules.json';

export function getDayType(date: Date): TramDayType {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

export function getScheduleForLine(
  lineId: string,
  direction: TramDirection,
): TramLineSchedule | undefined {
  const line = (scheduleData.lines as unknown as Record<string, TramLine>)[lineId];
  if (!line) return undefined;
  return line.departures.find((d) => d.direction === direction);
}

export function getNextDepartures(
  lineId: string,
  direction: TramDirection,
  from: Date,
  count = 3,
): NextDeparture[] {
  const schedule = getScheduleForLine(lineId, direction);
  if (!schedule) return [];

  const dayType = getDayType(from);
  const times = schedule.schedule[dayType];
  const nowMinutes = from.getHours() * 60 + from.getMinutes();

  const results: NextDeparture[] = [];
  for (const time of times) {
    const [h, m] = time.split(':').map(Number);
    const depMinutes = h * 60 + m;
    const diff = depMinutes - nowMinutes;
    if (diff >= 0) {
      results.push({
        lineId,
        direction,
        fromStation: schedule.fromStation,
        toStation: schedule.toStation,
        departureTime: time,
        minutesUntilDeparture: diff,
      });
      if (results.length >= count) break;
    }
  }
  return results;
}

export function getAllNextDepartures(from: Date, count = 3): NextDeparture[] {
  const lineIds = Object.keys(scheduleData.lines as unknown as Record<string, TramLine>);
  const directions: TramDirection[] = ['gidis', 'donus'];
  const all: NextDeparture[] = [];

  for (const lineId of lineIds) {
    for (const direction of directions) {
      all.push(...getNextDepartures(lineId, direction, from, count));
    }
  }

  return all.sort((a, b) => a.minutesUntilDeparture - b.minutesUntilDeparture);
}

export function getDeparturesForHour(
  lineId: string,
  direction: TramDirection,
  dayType: TramDayType,
  hour: number,
): string[] {
  const schedule = getScheduleForLine(lineId, direction);
  if (!schedule) return [];
  return schedule.schedule[dayType].filter((t) => {
    const h = parseInt(t.split(':')[0], 10);
    return h === hour;
  });
}
