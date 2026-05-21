/**
 * Şehir bağlamı zenginleştirme demo.
 * Çalıştırma: npm run demo-context-enrichment
 */
import { buildCityContext } from './cityContextEngine';

type DemoScenario = {
  label: string;
  date: string;
  hour: number;
};

const SCENARIOS: DemoScenario[] = [
  { label: 'Maç günü (Kadir Has)', date: '2025-03-15', hour: 18 },
  { label: 'Normal hafta içi gün', date: '2025-03-12', hour: 8 },
  { label: 'Ara tatil / kış koşulu', date: '2025-01-25', hour: 9 },
];

function printScenario({ label, date, hour }: DemoScenario): void {
  const context = buildCityContext(date, hour);

  console.log(`\n=== ${label} ===`);
  console.log(`date=${date} hour=${hour}`);
  console.log(`overallImpact=${context.overallImpactLevel}`);
  console.log(`dayLabel=${context.calendar.dayLabel}`);
  console.log(
    `calendar: weekend=${context.calendar.isWeekend} schoolTerm=${context.calendar.isSchoolTerm} midterm=${context.calendar.isMidtermBreak} holiday=${context.calendar.isOfficialHoliday}`
  );

  console.log('\nEtkinlikler:');
  if (!context.events.length) {
    console.log('  (aktif etkinlik yok)');
  } else {
    for (const e of context.events) {
      console.log(`  • [${e.eventType}] ${e.eventName} @ ${e.locationName}`);
      console.log(`    etki=${e.impactLevel} duraklar=${e.affectedStationGroupIds.join(', ')}`);
    }
  }

  console.log('\nHava:');
  console.log(
    `  ${context.weather.condition} ${context.weather.temperature}°C yağış=%${context.weather.precipitationProbability} etki=${context.weather.impactLevel}`
  );
  console.log(`  ${context.weather.notes}`);

  console.log('\nAçıklamalar:');
  for (const text of context.explanationTexts) {
    console.log(`  • ${text}`);
  }

  console.log('\nJSON (özet):');
  console.log(JSON.stringify(context, null, 2));
}

function main(): void {
  console.log('=== Context Enrichment Demo ===');
  for (const scenario of SCENARIOS) {
    printScenario(scenario);
  }
  console.log('\n=== Demo tamamlandı ===');
}

main();
