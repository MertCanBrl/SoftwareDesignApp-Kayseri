export function getPredictionConfidence(date: string) {
  const today = new Date();
  const target = new Date(date);

  const diffDays = Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 7) return 'Yüksek';
  if (diffDays <= 30) return 'Orta';
  return 'Düşük';
}
