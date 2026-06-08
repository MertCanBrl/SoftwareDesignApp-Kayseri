import type { EventContext, EventType } from './contextTypes';
import { eventActiveAtHour } from './contextEnrichmentUtils';

import events2025Raw from '../../assets/data/events/events-2025.json';
import events2026Raw from '../../assets/data/events/events-2026.json';

type RawEvent = {
  id: string;
  eventType: string;
  date: string;
  startHour: number;
  endHour: number;
  impactLevel: string;
  affectedStationIds: string[];
  description: string;
};

type EventsJsonFile = {
  year: number;
  description: string;
  events: RawEvent[];
};

// Dış veri kaynaklarında kullanılabilecek tür takma adları
const EVENT_TYPE_ALIAS: Readonly<Record<string, EventType>> = {
  SPORT_EVENT: 'MATCH',
  CITY_EVENT: 'OTHER',
  UNIVERSITY_EXAM: 'EXAM',
  NATIONAL_EXAM: 'EXAM',
  PUBLIC_EVENT: 'MEETING',
};

const VALID_EVENT_TYPES = new Set<string>([
  'MATCH', 'CONCERT', 'FESTIVAL', 'MEETING', 'EXAM', 'GRADUATION', 'FAIR', 'ROAD_CLOSURE', 'OTHER',
]);

function resolveEventType(raw: string): EventType {
  if (raw in EVENT_TYPE_ALIAS) return EVENT_TYPE_ALIAS[raw] as EventType;
  if (VALID_EVENT_TYPES.has(raw)) return raw as EventType;
  return 'OTHER';
}

function mapRawEvent(raw: RawEvent): EventContext {
  return {
    eventId: raw.id,
    eventType: resolveEventType(raw.eventType),
    eventName: raw.description,
    date: raw.date,
    startHour: raw.startHour,
    endHour: raw.endHour,
    locationName: '',
    affectedStationGroupIds: raw.affectedStationIds,
    impactLevel: raw.impactLevel as EventContext['impactLevel'],
    expectedDirectionBias: null,
    notes: raw.description,
    source: 'MANUAL',
  };
}

const EVENT_FILES: Readonly<Record<number, EventsJsonFile>> = {
  2025: events2025Raw as EventsJsonFile,
  2026: events2026Raw as EventsJsonFile,
};

function getEventsForYear(year: number): EventContext[] {
  const file = EVENT_FILES[year];
  if (!file) return [];
  return file.events.map(mapRawEvent);
}

export function getEventsForDate(date: string): EventContext[] {
  const year = parseInt(date.slice(0, 4), 10);
  return getEventsForYear(year).filter((e) => e.date === date).map(cloneEvent);
}

export function getEventsAffectingStation(
  stationGroupId: string,
  date: string
): EventContext[] {
  const year = parseInt(date.slice(0, 4), 10);
  return getEventsForYear(year)
    .filter((e) => e.date === date && e.affectedStationGroupIds.includes(stationGroupId))
    .map(cloneEvent);
}

/** Saat aralığına göre aktif etkinlikler (city context için). */
export function getActiveEventsForDateHour(date: string, hour: number): EventContext[] {
  const year = parseInt(date.slice(0, 4), 10);
  return getEventsForYear(year).filter((e) => eventActiveAtHour(e, date, hour)).map(cloneEvent);
}

function cloneEvent(event: EventContext): EventContext {
  return {
    ...event,
    affectedStationGroupIds: [...event.affectedStationGroupIds],
  };
}
