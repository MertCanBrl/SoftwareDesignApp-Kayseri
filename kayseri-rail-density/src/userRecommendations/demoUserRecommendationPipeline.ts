/**
 * demoUserRecommendationPipeline.ts
 *
 * UserTravelRecommendationPipeline için 6 senaryo testi.
 * LLM / async / network içermez; doğrudan çalıştırılabilir:
 *   npx ts-node src/userRecommendations/demoUserRecommendationPipeline.ts
 */

import type { UserRecommendationInput } from './userRecommendationTypes';
import type { EstimatedStationPassage } from '../transitNetwork/stationPassageUtils';
import type { PassagePassengerDistribution } from '../transitNetwork/passengerDistributionUtils';
import { runUserRecommendationPipeline } from './runUserRecommendationPipeline';
import { detectBannedPhrases, runSafetyExplanationAgent } from './safetyExplanationAgent';

// ---------------------------------------------------------------------------
// Mock veri yardımcıları
// ---------------------------------------------------------------------------

function makePassage(
  stationId: string,
  lineId: string,
  direction: 'gidis' | 'donus',
  passageTime: string,
): EstimatedStationPassage {
  return {
    stationId,
    lineId,
    direction,
    terminalDepartureTime: passageTime,
    estimatedPassageTime: passageTime,
    offsetMinutes: 5,
    confidence: 'high',
    source: 'schedule_plus_estimated_offset',
  };
}

function makeDistributed(
  passageTime: string,
  lineId: string,
  direction: string,
  passengers: number,
): PassagePassengerDistribution {
  return {
    estimatedPassageTime: passageTime,
    lineId,
    direction,
    estimatedPassengers: passengers,
    confidence: 'high',
    explanation: 'Saatlik yolcu tahmini, bu saat dilimindeki tahmini geçişlere eşit dağıtılmıştır.',
  };
}

// 4 adet high-confidence geçiş (T1 Gidiş)
const passages4: EstimatedStationPassage[] = [
  makePassage('ANAYURT', 'T1', 'gidis', '10:07'),
  makePassage('ANAYURT', 'T1', 'gidis', '10:22'),
  makePassage('ANAYURT', 'T1', 'gidis', '10:37'),
  makePassage('ANAYURT', 'T1', 'gidis', '10:52'),
];

const distributed4Low: PassagePassengerDistribution[] = [
  makeDistributed('10:07', 'T1', 'gidis', 11),
  makeDistributed('10:22', 'T1', 'gidis', 11),
  makeDistributed('10:37', 'T1', 'gidis', 11),
  makeDistributed('10:52', 'T1', 'gidis', 12),
];

const distributed4High: PassagePassengerDistribution[] = [
  makeDistributed('14:07', 'T1', 'gidis', 75),
  makeDistributed('14:22', 'T1', 'gidis', 75),
  makeDistributed('14:37', 'T1', 'gidis', 75),
  makeDistributed('14:52', 'T1', 'gidis', 75),
];

const distributed4VeryHigh: PassagePassengerDistribution[] = [
  makeDistributed('17:07', 'T1', 'gidis', 87),
  makeDistributed('17:22', 'T1', 'gidis', 87),
  makeDistributed('17:37', 'T1', 'gidis', 87),
  makeDistributed('17:52', 'T1', 'gidis', 89),
];

const passages4VH: EstimatedStationPassage[] = [
  makePassage('ANAYURT', 'T1', 'gidis', '17:07'),
  makePassage('ANAYURT', 'T1', 'gidis', '17:22'),
  makePassage('ANAYURT', 'T1', 'gidis', '17:37'),
  makePassage('ANAYURT', 'T1', 'gidis', '17:52'),
];

const passages4M: EstimatedStationPassage[] = [
  makePassage('ANAYURT', 'T1', 'gidis', '14:07'),
  makePassage('ANAYURT', 'T1', 'gidis', '14:22'),
  makePassage('ANAYURT', 'T1', 'gidis', '14:37'),
  makePassage('ANAYURT', 'T1', 'gidis', '14:52'),
];

// ---------------------------------------------------------------------------
// Senaryo tanımları
// ---------------------------------------------------------------------------

type DemoScenario = {
  label: string;
  input: UserRecommendationInput;
};

const scenarios: DemoScenario[] = [
  // 1. Düşük yoğunluk + 4 passage → go_now
  {
    label: 'Senaryo 1: Düşük yoğunluk + 4 passage → go_now',
    input: {
      stationId: 'ANAYURT',
      stationName: 'Anayurt',
      selectedDate: '2026-06-18',
      selectedHour: 10,
      hourlyPassengerCount: 45,
      densityLevel: 'Çok Düşük',
      densityRank: 2,
      estimatedPassages: passages4,
      distributedPassages: distributed4Low,
      nearbyStationsDensity: [],
      dataType: 'actual',
      predictionConfidence: null,
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },

  // 2. Orta yoğunluk + 4 passage → wait_for_passage
  {
    label: 'Senaryo 2: Orta yoğunluk + 4 passage → wait_for_passage',
    input: {
      stationId: 'ANAYURT',
      stationName: 'Anayurt',
      selectedDate: '2026-06-18',
      selectedHour: 14,
      hourlyPassengerCount: 300,
      densityLevel: 'Orta',
      densityRank: 4,
      estimatedPassages: passages4M,
      distributedPassages: distributed4High,
      nearbyStationsDensity: [],
      dataType: 'actual',
      predictionConfidence: null,
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },

  // 3. Çok yüksek yoğunluk + passage var → check_next_hour
  {
    label: 'Senaryo 3: Çok yüksek yoğunluk + passage var → check_next_hour',
    input: {
      stationId: 'ANAYURT',
      stationName: 'Anayurt',
      selectedDate: '2026-06-18',
      selectedHour: 17,
      hourlyPassengerCount: 350,
      densityLevel: 'Çok Yüksek',
      densityRank: 6,
      estimatedPassages: passages4VH,
      distributedPassages: distributed4VeryHigh,
      nearbyStationsDensity: [],
      dataType: 'actual',
      predictionConfidence: null,
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },

  // 4. predictionConfidence low → no_data
  {
    label: 'Senaryo 4: predictionConfidence low → no_data',
    input: {
      stationId: 'DEVELI',
      stationName: 'Develi',
      selectedDate: '2026-09-01', // 30+ gün ileride
      selectedHour: 9,
      hourlyPassengerCount: 120,
      densityLevel: 'Orta',
      densityRank: 4,
      estimatedPassages: passages4,
      distributedPassages: distributed4Low,
      nearbyStationsDensity: [],
      dataType: 'prediction',
      predictionConfidence: 'low',
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },

  // 5. estimatedPassages/distributedPassages boş → saatlik fallback
  {
    label: 'Senaryo 5: Boş passage listesi → saatlik fallback (Düşük → go_now)',
    input: {
      stationId: 'SERCEONÜ',
      stationName: 'Serçeönü',
      selectedDate: '2026-06-18',
      selectedHour: 8,
      hourlyPassengerCount: 80,
      densityLevel: 'Düşük',
      densityRank: 3,
      estimatedPassages: [],
      distributedPassages: [],
      nearbyStationsDensity: [],
      dataType: 'actual',
      predictionConfidence: null,
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },

  // 6. SafetyExplanationAgent test: yasaklı ifade ile bozuk bir çıktıyı filtrele
  {
    label: 'Senaryo 6: SafetyExplanationAgent filtreleme testi (kesin gelecek + garanti boş)',
    input: {
      stationId: 'MOCK_STATION',
      stationName: 'Mock Durak',
      selectedDate: '2026-06-18',
      selectedHour: 12,
      hourlyPassengerCount: 15,
      densityLevel: 'Seyrek',
      densityRank: 1,
      estimatedPassages: passages4,
      distributedPassages: distributed4Low,
      nearbyStationsDensity: [],
      dataType: 'actual',
      predictionConfidence: null,
      serviceDayType: 'weekday',
      isParentView: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Demo çalıştırıcı
// ---------------------------------------------------------------------------

function printDivider(): void {
  console.log('\n' + '─'.repeat(72));
}

function runDemo(): void {
  console.log('=== UserTravelRecommendationPipeline Demo ===\n');

  for (const scenario of scenarios) {
    printDivider();
    console.log(`📍 ${scenario.label}`);

    const output = runUserRecommendationPipeline(scenario.input);

    console.log(`  action     : ${output.action}`);
    console.log(`  confidence : ${output.confidence}`);
    console.log(`  headline   : ${output.headline}`);
    console.log(`  detail     : ${output.detail}`);
    if (output.recommendedPassageTime) {
      console.log(`  passage    : ${output.recommendedPassageTime} civarı`);
    }
    if (output.nearbyStationName) {
      console.log(`  nearby     : ${output.nearbyStationName}`);
    }
    console.log(`  explanation: ${output.explanation}`);

    // Yasaklı ifade kontrolü
    const allText = [output.headline, output.detail, output.explanation].join(' ');
    const banned = detectBannedPhrases(allText);
    if (banned.length > 0) {
      console.log(`  ⚠️  BANNED PHRASES FOUND: ${banned.join(', ')}`);
    } else {
      console.log('  ✅ Yasaklı ifade yok');
    }
  }

  // --- SafetyExplanationAgent direkt filtre testi ---
  printDivider();
  console.log('🛡  SafetyExplanationAgent Direkt Filtre Testi');

  const poisonedOutput = {
    action: 'go_now' as const,
    headline: 'Tramvay kesin gelecek — garanti boş',
    detail: 'Canlı varış: tramvay kesin 20 kişi ile dolacak.',
    confidence: 'high' as const,
    explanation: 'Özel açıklama',
  };

  console.log('\n  [Ham metin]');
  console.log(`  headline : ${poisonedOutput.headline}`);
  console.log(`  detail   : ${poisonedOutput.detail}`);

  const cleaned = runSafetyExplanationAgent(poisonedOutput);
  console.log('\n  [Filtrelenmiş metin]');
  console.log(`  headline : ${cleaned.headline}`);
  console.log(`  detail   : ${cleaned.detail}`);
  console.log(`  explanation: ${cleaned.explanation}`);

  const allCleaned = [cleaned.headline, cleaned.detail, cleaned.explanation].join(' ');
  const stillBanned = detectBannedPhrases(allCleaned);
  if (stillBanned.length > 0) {
    console.log(`  ⚠️  HÂLÂ YASAKLI İFADE VAR: ${stillBanned.join(', ')}`);
  } else {
    console.log('  ✅ Tüm yasaklı ifadeler temizlendi');
  }

  printDivider();
  console.log('\nDemo tamamlandı.');
}

runDemo();
