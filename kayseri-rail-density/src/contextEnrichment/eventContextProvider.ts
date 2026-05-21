import type { EventContext } from './contextTypes';
import { eventActiveAtHour } from './contextEnrichmentUtils';

/** Mock şehir etkinlikleri — ileride harici etkinlik API’sine bağlanabilir. */
const MOCK_EVENTS: readonly EventContext[] = [
  {
    eventId: 'evt-match-kadirhas-2025-03-15',
    eventType: 'MATCH',
    eventName: 'Kayseri Spor — Süper Lig ev sahibi maçı',
    date: '2025-03-15',
    startHour: 18,
    endHour: 22,
    locationName: 'Kadir Has Stadyumu',
    affectedStationGroupIds: ['1006008', '1006009', '1006010', '1006019'],
    impactLevel: 'HIGH',
    expectedDirectionBias: 'Stadyum ve Cumhuriyet Meydanı çevresine akşam yönü baskın',
    notes: 'Maç öncesi/sonrası Stadyum ve merkez duraklarda yoğunluk beklenir.',
    source: 'MANUAL',
  },
  {
    eventId: 'evt-meeting-cumhuriyet-2025-04-12',
    eventType: 'MEETING',
    eventName: 'Cumhuriyet Meydanı toplu etkinlik',
    date: '2025-04-12',
    startHour: 14,
    endHour: 18,
    locationName: 'Cumhuriyet Meydanı',
    affectedStationGroupIds: ['1006019', '1006020', '1006021'],
    impactLevel: 'MEDIUM',
    expectedDirectionBias: 'Merkez duraklara öğleden sonra giriş artışı',
    notes: 'Miting/etkinlik nedeniyle merkez tramvay talebi artabilir.',
    source: 'MANUAL',
  },
  {
    eventId: 'evt-exam-erciyes-2025-06-10',
    eventType: 'EXAM',
    eventName: 'Erciyes Üniversitesi final sınavları',
    date: '2025-06-10',
    startHour: 8,
    endHour: 17,
    locationName: 'Erciyes Üniversitesi Kampüsü',
    affectedStationGroupIds: ['1006048', '1006049', '1006052', '1006047'],
    impactLevel: 'MEDIUM',
    expectedDirectionBias: 'Sabah kampüse, öğleden sonra şehir merkezine',
    notes: 'Sınav günü üniversite hattında sabah pik talebi artabilir.',
    source: 'MANUAL',
  },
  {
    eventId: 'evt-graduation-erciyes-2025-06-20',
    eventType: 'GRADUATION',
    eventName: 'Erciyes Üniversitesi mezuniyet töreni',
    date: '2025-06-20',
    startHour: 10,
    endHour: 16,
    locationName: 'Erciyes Üniversitesi Kampüsü',
    affectedStationGroupIds: ['1006048', '1006049', '1006052'],
    impactLevel: 'HIGH',
    expectedDirectionBias: 'Kampüs çevresine sabah-öğle giriş, akşam çıkış',
    notes: 'Mezuniyet günü aile ziyaretçileri nedeniyle talep artışı.',
    source: 'MANUAL',
  },
  {
    eventId: 'evt-fair-ildem-2025-05-03',
    eventType: 'FAIR',
    eventName: 'İldem bölgesi fuar etkinliği',
    date: '2025-05-03',
    startHour: 11,
    endHour: 20,
    locationName: 'İldem',
    affectedStationGroupIds: ['1006039', '1006040', '1006041'],
    impactLevel: 'LOW',
    expectedDirectionBias: 'İldem hattına gün içi dağılmış talep',
    notes: 'Bölgesel fuar — hat üzerinde orta düzey artış.',
    source: 'MANUAL',
  },
];

export function getEventsForDate(date: string): EventContext[] {
  return MOCK_EVENTS.filter((e) => e.date === date).map(cloneEvent);
}

export function getEventsAffectingStation(
  stationGroupId: string,
  date: string
): EventContext[] {
  return MOCK_EVENTS.filter(
    (e) => e.date === date && e.affectedStationGroupIds.includes(stationGroupId)
  ).map(cloneEvent);
}

/** Saat aralığına göre aktif etkinlikler (city context için). */
export function getActiveEventsForDateHour(date: string, hour: number): EventContext[] {
  return MOCK_EVENTS.filter((e) => eventActiveAtHour(e, date, hour)).map(cloneEvent);
}

function cloneEvent(event: EventContext): EventContext {
  return {
    ...event,
    affectedStationGroupIds: [...event.affectedStationGroupIds],
  };
}
