import type { UserRecommendationOutput } from './userRecommendationTypes';

// ---------------------------------------------------------------------------
// Yasaklı ifade → güvenli karşılık
// ---------------------------------------------------------------------------

type ReplacementRule = { pattern: RegExp; replacement: string };

const BANNED_PHRASES: ReplacementRule[] = [
  { pattern: /kesinlikle gelecek/gi, replacement: 'bekleniyor' },
  { pattern: /kesin gelecek/gi, replacement: 'bekleniyor' },
  { pattern: /canlı varış/gi, replacement: 'tahmini geçiş' },
  { pattern: /garanti boş/gi, replacement: 'sakin görünüyor' },
  { pattern: /garanti dolu/gi, replacement: 'dolu görünebilir' },
  { pattern: /kesin \d+ kişi/gi, replacement: 'yaklaşık yolcu bekleniyor' },
  { pattern: /kesin \d+ yolcu/gi, replacement: 'yaklaşık yolcu bekleniyor' },
  { pattern: /\bdolacak\b/gi, replacement: 'yoğunlaşabilir' },
  // "gelecektir" / "gelecek!" gibi kesinlik iddiaları
  { pattern: /gelecektir/gi, replacement: 'bekleniyor' },
  { pattern: /gelecek!/gi, replacement: 'bekleniyor' },
  // Canlı/gerçek zamanlı iddiası
  { pattern: /gerçek (zamanlı|zamanlı) (konum|veri)/gi, replacement: 'tahmini veri' },
  // Garanti + boşluk kombinasyonları
  { pattern: /\bgaranti\b/gi, replacement: 'tahmine göre' },
];

const STANDARD_EXPLANATION =
  'Sefer çizelgesine göre tahminidir. Gerçek zamanlı konum değildir. ±2-5 dk sapma olabilir.';

// ---------------------------------------------------------------------------
// Metin temizleme yardımcısı
// ---------------------------------------------------------------------------

function sanitizeText(text: string): string {
  let result = text;
  for (const rule of BANNED_PHRASES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Dışa açık API
// ---------------------------------------------------------------------------

/**
 * UserRecommendationOutput'taki headline, detail ve explanation alanlarını
 * tarar; yasaklı ifadeleri güvenli karşılıklarıyla değiştirir ve
 * explanation alanının standart not ile bitmesini garantiler.
 *
 * Bu agent sayı üretmez; yalnızca metin filtresi uygular.
 */
export function runSafetyExplanationAgent(
  output: UserRecommendationOutput,
): UserRecommendationOutput {
  const cleanHeadline = sanitizeText(output.headline);
  const cleanDetail = sanitizeText(output.detail);

  // explanation zaten standart not içeriyorsa tekrar ekleme
  const baseExplanation = sanitizeText(output.explanation);
  const cleanExplanation = baseExplanation.includes(STANDARD_EXPLANATION)
    ? baseExplanation
    : `${baseExplanation} ${STANDARD_EXPLANATION}`.trim();

  return {
    ...output,
    headline: cleanHeadline,
    detail: cleanDetail,
    explanation: cleanExplanation,
  };
}

/**
 * Verilen metinde yasaklı ifade var mı kontrol eder (test/demo için).
 */
export function detectBannedPhrases(text: string): string[] {
  const found: string[] = [];
  for (const rule of BANNED_PHRASES) {
    const matches = text.match(rule.pattern);
    if (matches) {
      found.push(...matches);
    }
  }
  return found;
}
