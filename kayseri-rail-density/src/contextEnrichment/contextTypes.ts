/**
 * Şehir bağlamı zenginleştirme tipleri — JSON-serializable.
 * İleride NewsAgent / hava API sağlayıcıları bu arayüzlere bağlanabilir.
 */

export type ContextImpactLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type ContextSource = 'CALENDAR' | 'EVENTS' | 'WEATHER' | 'MANUAL' | 'CONFIG';

export type AcademicPeriod =
  | 'SCHOOL_TERM'
  | 'SCHOOL_BREAK'
  | 'UNIVERSITY_TERM'
  | 'UNIVERSITY_BREAK'
  | 'HOLIDAY'
  | 'OUT_OF_SESSION';

export type CalendarContext = {
  date: string;
  isWeekend: boolean;
  isOfficialHoliday: boolean;
  isReligiousHoliday: boolean;
  isHolidayEve: boolean;
  isSchoolTerm: boolean;
  isMidtermBreak: boolean;
  isUniversityTerm: boolean;
  academicPeriod: AcademicPeriod;
  dayLabel: string;
};

export type EventType =
  | 'MATCH'
  | 'CONCERT'
  | 'FESTIVAL'
  | 'MEETING'
  | 'EXAM'
  | 'GRADUATION'
  | 'FAIR'
  | 'ROAD_CLOSURE'
  | 'OTHER';

export type WeatherCondition =
  | 'CLEAR'
  | 'CLOUDY'
  | 'RAIN'
  | 'SNOW'
  | 'STORM'
  | 'FOG'
  | 'WIND';

export type EventContext = {
  eventId: string;
  eventType: EventType;
  eventName: string;
  date: string;
  startHour: number;
  endHour: number;
  locationName: string;
  affectedStationGroupIds: readonly string[];
  impactLevel: ContextImpactLevel;
  expectedDirectionBias: string | null;
  notes: string;
  source: ContextSource;
};

export type WeatherContext = {
  date: string;
  hour: number;
  condition: WeatherCondition;
  temperature: number;
  precipitationProbability: number;
  rain: boolean;
  snow: boolean;
  windSpeed: number;
  impactLevel: ContextImpactLevel;
  notes: string;
};

export type CityContext = {
  calendar: CalendarContext;
  events: readonly EventContext[];
  weather: WeatherContext;
  overallImpactLevel: ContextImpactLevel;
  explanationTexts: readonly string[];
};

export type EnrichedAnalysisContext = {
  date: string;
  hour: number;
  city: CityContext;
  sources: readonly ContextSource[];
  builtAt: string;
};
