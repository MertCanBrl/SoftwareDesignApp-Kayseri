import { getCalendarContext } from './calendarContextProvider';
import type { CityContext, ContextImpactLevel, ContextSource } from './contextTypes';
import { getActiveEventsForDateHour } from './eventContextProvider';
import { maxImpactLevel } from './contextEnrichmentUtils';
import { getWeatherContext } from './weatherContextProvider';

/**
 * Takvim, etkinlik ve hava verisini birleştirerek şehir bağlamı üretir.
 */
export function buildCityContext(date: string, hour: number): CityContext {
  const calendar = getCalendarContext(date);
  const events = getActiveEventsForDateHour(date, hour);
  const weather = getWeatherContext(date, hour);

  const eventImpact = maxImpactLevel(
    'NONE',
    ...events.map((e) => e.impactLevel)
  );

  const calendarImpact = resolveCalendarImpact(calendar);
  const overallImpactLevel = maxImpactLevel(calendarImpact, eventImpact, weather.impactLevel);

  const explanationTexts = buildExplanationTexts(calendar, events, weather, hour);

  return {
    calendar,
    events,
    weather,
    overallImpactLevel,
    explanationTexts,
  };
}

export function buildEnrichedAnalysisContext(date: string, hour: number) {
  const city = buildCityContext(date, hour);
  const sources: ContextSource[] = ['CALENDAR', 'EVENTS', 'WEATHER'];
  return {
    date,
    hour,
    city,
    sources,
    builtAt: new Date().toISOString(),
  };
}

function resolveCalendarImpact(
  calendar: ReturnType<typeof getCalendarContext>
): ContextImpactLevel {
  if (calendar.isOfficialHoliday || calendar.isReligiousHoliday) return 'MEDIUM';
  if (calendar.isHolidayEve) return 'LOW';
  if (calendar.isMidtermBreak) return 'LOW';
  if (calendar.isSchoolTerm && !calendar.isWeekend) return 'MEDIUM';
  return 'NONE';
}

function buildExplanationTexts(
  calendar: ReturnType<typeof getCalendarContext>,
  events: ReturnType<typeof getActiveEventsForDateHour>,
  weather: ReturnType<typeof getWeatherContext>,
  hour: number
): string[] {
  const texts: string[] = [];

  if (calendar.isSchoolTerm && !calendar.isWeekend && !calendar.isMidtermBreak) {
    if (hour >= 7 && hour <= 9) {
      texts.push(
        'Bugün hafta içi ve okul dönemi açık olduğu için sabah pik talebi artabilir.'
      );
    } else {
      texts.push(
        'Okul dönemi devam ediyor; hafta içi öğrenci ve personel hareketliliği talebi etkileyebilir.'
      );
    }
  }

  if (calendar.academicPeriod === 'UNIVERSITY_BREAK') {
    texts.push('Üniversite ara tatilinde kampüs talebi düşük olabilir.');
  } else if (calendar.isUniversityTerm && hour >= 8 && hour <= 10) {
    texts.push('Üniversite dönemi sabah saatlerinde kampüs hattında talep artışı görülebilir.');
  }

  if (calendar.isMidtermBreak) {
    texts.push('Ara tatil döneminde okul kaynaklı sabah pik talebi azalabilir.');
  }

  if (calendar.isOfficialHoliday || calendar.isReligiousHoliday) {
    texts.push('Resmi veya dini tatil nedeniyle iş/okul kaynaklı talep düşük, boş zaman talebi değişken olabilir.');
  }

  if (calendar.isHolidayEve) {
    texts.push('Bayram arifesi — akşam saatlerinde şehir içi hareketlilik artabilir.');
  }

  if (calendar.isWeekend && !calendar.isOfficialHoliday) {
    texts.push('Hafta sonu — işe gidiş pikleri zayıf, alışveriş ve sosyal talep daha belirgin olabilir.');
  }

  for (const event of events) {
    if (event.eventType === 'MATCH') {
      texts.push(
        'Kadir Has Stadyumu çevresindeki maç etkinliği nedeniyle yakın duraklarda yoğunluk beklenebilir.'
      );
    } else if (event.eventType === 'MEETING') {
      texts.push(
        `${event.locationName} bölgesindeki etkinlik nedeniyle merkez duraklarda talep artışı görülebilir.`
      );
    } else if (event.eventType === 'EXAM' || event.eventType === 'GRADUATION') {
      texts.push(
        `${event.locationName} çevresinde ${event.eventType === 'EXAM' ? 'sınav' : 'mezuniyet'} günü üniversite hattında yoğunluk artabilir.`
      );
    } else {
      texts.push(`${event.eventName} — ${event.locationName} çevresinde talep etkisi olası.`);
    }
  }

  if (weather.rain && weather.impactLevel !== 'NONE') {
    texts.push(
      'Yağışlı hava nedeniyle kısa mesafe yürüyüş yerine tramvay kullanımı artabilir.'
    );
  }

  if (weather.snow && weather.impactLevel !== 'NONE') {
    texts.push('Karlı/kar riski havasında toplu taşıma talebi ve sefer güvenilirliği izlenmelidir.');
  }

  if (weather.windSpeed >= 20 && !weather.rain) {
    texts.push('Kuvvetli rüzgar — açık peronlarda bekleme konforu düşebilir.');
  }

  return texts;
}
