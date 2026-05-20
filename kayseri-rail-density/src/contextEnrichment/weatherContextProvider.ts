import type { ContextImpactLevel, WeatherCondition, WeatherContext } from './contextTypes';
import { parseYmd } from './contextEnrichmentUtils';

type WeatherProfile = {
  condition: WeatherCondition;
  temperature: number;
  precipitationProbability: number;
  rain: boolean;
  snow: boolean;
  windSpeed: number;
  impactLevel: ContextImpactLevel;
  notes: string;
};

/**
 * Mock hava durumu — tarih/saat hash’i ile tutarlı örnek profiller.
 * İleride OpenWeather vb. API ile değiştirilebilir.
 */
export function getWeatherContext(date: string, hour: number): WeatherContext {
  const profile = resolveMockProfile(date, hour);
  return {
    date,
    hour,
    ...profile,
  };
}

function resolveMockProfile(date: string, hour: number): WeatherProfile {
  const parsed = parseYmd(date);
  const month = parsed ? parsed.getMonth() + 1 : 3;
  const dayOfMonth = parsed ? parsed.getDate() : 1;
  const seed = date.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + hour + dayOfMonth;

  if (date === '2025-03-15' && hour >= 17) {
    return {
      condition: 'RAIN',
      temperature: 8,
      precipitationProbability: 75,
      rain: true,
      snow: false,
      windSpeed: 22,
      impactLevel: 'HIGH',
      notes: 'Maç günü akşam sağanak yağış bekleniyor.',
    };
  }

  if (date === '2025-01-25') {
    return {
      condition: 'SNOW',
      temperature: -2,
      precipitationProbability: 60,
      rain: false,
      snow: true,
      windSpeed: 15,
      impactLevel: 'MEDIUM',
      notes: 'Ara tatil günü kar yağışı ihtimali.',
    };
  }

  if (month >= 6 && month <= 8 && seed % 5 === 0) {
    return {
      condition: 'CLEAR',
      temperature: 32,
      precipitationProbability: 5,
      rain: false,
      snow: false,
      windSpeed: 8,
      impactLevel: 'LOW',
      notes: 'Yaz sıcağı — açık hava.',
    };
  }

  if (seed % 7 === 0) {
    return {
      condition: 'RAIN',
      temperature: month <= 3 || month >= 11 ? 6 : 14,
      precipitationProbability: 70,
      rain: true,
      snow: false,
      windSpeed: 18,
      impactLevel: 'HIGH',
      notes: 'Yağışlı hava — yürüyüş yerine toplu taşıma tercihi artabilir.',
    };
  }

  if (seed % 11 === 0) {
    return {
      condition: 'CLOUDY',
      temperature: 12,
      precipitationProbability: 35,
      rain: false,
      snow: false,
      windSpeed: 12,
      impactLevel: 'LOW',
      notes: 'Bulutlu, hafif rüzgarlı.',
    };
  }

  return {
    condition: hour >= 6 && hour <= 20 ? 'CLEAR' : 'CLOUDY',
    temperature: month <= 3 || month >= 11 ? 5 + (hour % 6) : 15 + (hour % 8),
    precipitationProbability: 10,
    rain: false,
    snow: false,
    windSpeed: 10,
    impactLevel: 'NONE',
    notes: 'Tipik mevsim koşulları.',
  };
}
