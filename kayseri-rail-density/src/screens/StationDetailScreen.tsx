import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import type { StationRecord } from '../types';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PassengerChart } from '../components/PassengerChart';
import { StatCard } from '../components/StatCard';
import { theme } from '../constants/theme';
import { getDensityLevel, TRAM_CAPACITY } from '../constants/densityLevels';
import { useSelection } from '../context/SelectionContext';
import { formatDisplayDate } from '../utils/date';
import { getPredictionConfidence } from '../utils/predictionConfidence';
import {
  getBestHoursByPeriod,
  getCurrentAndNextRecommendation,
  getHourlyTrendData,
  getHourlyTrendDataChartSeries,
  getStationHourlyRows,
} from '../utils/recommendations';
import {
  getBusiestHour,
  getDailyStationData,
  getPassengerCountByStationDateHour,
} from '../utils/statistics';
import { getEstimatedStationPassages } from '../transitNetwork/stationPassageUtils';
import { distributeHourlyPassengersToPassages } from '../transitNetwork/passengerDistributionUtils';
import { runUserRecommendationPipeline } from '../userRecommendations/runUserRecommendationPipeline';

// ---------------------------------------------------------------------------
// Pipeline input helpers — yalnızca userRecommendationPipeline için kullanılır
// ---------------------------------------------------------------------------

const DENSITY_RANK_MAP: Record<string, number> = {
  Seyrek: 1,
  'Çok Düşük': 2,
  Düşük: 3,
  Orta: 4,
  Yüksek: 5,
  'Çok Yüksek': 6,
  'Kapasite Aşımı': 7,
};

function getDensityRank(label: string): number {
  return DENSITY_RANK_MAP[label] ?? 1;
}

function mapPredictionConfidence(
  label: string | null,
): 'high' | 'medium' | 'low' | null {
  if (label === 'Yüksek') return 'high';
  if (label === 'Orta') return 'medium';
  if (label === 'Düşük') return 'low';
  return null;
}

function getServiceDayType(
  dateStr: string,
): 'weekday' | 'saturday' | 'sunday' {
  const parts = dateStr.split('-').map(Number);
  const day = new Date(parts[0]!, parts[1]! - 1, parts[2]!).getDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return 'weekday';
}

export function StationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ durakId: string; tarih?: string; saat?: string }>();
  const {
    passengerRows,
    stations,
    sortedDates,
    tarih: ctxTarih,
    saat: ctxSaat,
    setTarih,
    dateDataKind,
    minAllowedSaat,
  } = useSelection();

  const durakId = String(params.durakId ?? '');

  // URL'den gelen tarih; sortedDates'e dahil değilse (misafir kısıtı) ctxTarih'e düşer
  const tarih = useMemo(() => {
    const paramDate = typeof params.tarih === 'string' && params.tarih ? params.tarih : '';
    if (!paramDate || !sortedDates.includes(paramDate)) return ctxTarih;
    return paramDate;
  }, [params.tarih, ctxTarih, sortedDates]);

  // URL'den gelen saat; minAllowedSaat'in altındaysa en küçük izin verilen değere kısıtlanır
  const saat = useMemo(() => {
    const paramSaat = params.saat != null ? Number(params.saat) : ctxSaat;
    return Math.max(paramSaat, minAllowedSaat);
  }, [params.saat, ctxSaat, minAllowedSaat]);

  // Geçerli bir tarih ise context'i güncelle (korumalı setTarih zaten geçersizi reddeder)
  useEffect(() => {
    const paramDate = typeof params.tarih === 'string' ? params.tarih : '';
    if (paramDate && paramDate !== ctxTarih && sortedDates.includes(paramDate)) {
      setTarih(paramDate);
    }
  }, [params.tarih, ctxTarih, setTarih, sortedDates]);

  const stationDirect = useMemo(
    () => stations.find((s) => s.durakId === durakId),
    [stations, durakId]
  );

  // parentDurakId ile gelindiğinde _G/_D child'larını bul
  const childStations = useMemo<StationRecord[]>(() => {
    if (stationDirect) return [];
    const dirRank = (s: StationRecord): number => {
      if (s.direction === 'gidis') return 0;
      if (s.direction === 'donus') return 2;
      if (s.durakId.endsWith('_G')) return 0;
      if (s.durakId.endsWith('_D')) return 2;
      return 1;
    };
    return stations
      .filter((s) => s.parentDurakId === durakId && s.durakId !== durakId)
      .sort((a, b) => dirRank(a) - dirRank(b));
  }, [stations, durakId, stationDirect]);

  const isParentView = !stationDirect && childStations.length > 0;

  // Gösterilecek station kaydı: doğrudan, parent synthetic, veya undefined
  const station = useMemo<StationRecord | undefined>(() => {
    if (stationDirect) return stationDirect;
    if (childStations.length === 0) return undefined;
    const first = childStations[0]!;
    const baseName = first.durakAd.replace(/ \((Gidiş|Dönüş)\)$/, '');
    return { ...first, durakId, durakAd: baseName, parentDurakId: durakId };
  }, [stationDirect, childStations, durakId]);

  // Saatlik veri: parent görünümünde _G + _D toplamı
  const hourly = useMemo(() => {
    if (!isParentView) return getDailyStationData(passengerRows, durakId, tarih);
    const hourMap = new Map<number, number>();
    for (const child of childStations) {
      for (const p of getDailyStationData(passengerRows, child.durakId, tarih)) {
        hourMap.set(p.saat, (hourMap.get(p.saat) ?? 0) + p.yolcuSayisi);
      }
    }
    return [...hourMap.entries()]
      .map(([s, y]) => ({ saat: s, yolcuSayisi: y }))
      .sort((a, b) => a.saat - b.saat);
  }, [passengerRows, durakId, tarih, isParentView, childStations]);

  const busiestHour = useMemo(() => getBusiestHour(hourly), [hourly]);

  const dailyTotal = useMemo(() => hourly.reduce((s, p) => s + p.yolcuSayisi, 0), [hourly]);
  const avg = useMemo(
    () => (hourly.length ? dailyTotal / hourly.length : 0),
    [dailyTotal, hourly.length]
  );

  // Seçilen saatteki yolcu: parent görünümünde child toplamı
  const selectedCount = useMemo(() => {
    if (!isParentView) return getPassengerCountByStationDateHour(passengerRows, durakId, tarih, saat);
    let total = 0;
    let found = false;
    for (const child of childStations) {
      const c = getPassengerCountByStationDateHour(passengerRows, child.durakId, tarih, saat);
      if (c != null) { total += c; found = true; }
    }
    return found ? total : null;
  }, [passengerRows, durakId, tarih, saat, isParentView, childStations]);

  // Öneri / trend için ilk child'ı (veya doğrudan durakId'yi) kullan
  const effectiveDurakId = isParentView ? (childStations[0]?.durakId ?? durakId) : durakId;

  const stationHourlyRows = useMemo(
    () => getStationHourlyRows(passengerRows, effectiveDurakId),
    [passengerRows, effectiveDurakId]
  );
  const periodBestHours = useMemo(
    () => getBestHoursByPeriod(passengerRows, effectiveDurakId),
    [passengerRows, effectiveDurakId]
  );
  const goRec = useMemo(
    () => getCurrentAndNextRecommendation(passengerRows, effectiveDurakId, saat),
    [passengerRows, effectiveDurakId, saat]
  );
  const trendData = useMemo(
    () => getHourlyTrendData(passengerRows, effectiveDurakId),
    [passengerRows, effectiveDurakId]
  );
  const trendChart = useMemo(() => getHourlyTrendDataChartSeries(trendData), [trendData]);
  const hasTrendGaps = useMemo(
    () => trendData.some((t) => t.passengerCount === null),
    [trendData]
  );
  const trendHighlightIndex = useMemo(() => {
    if (saat < 0 || saat > 23) return -1;
    const i = trendChart.hourKeys.findIndex((h) => h === saat);
    return i;
  }, [trendChart.hourKeys, saat]);
  const chartWidth = useMemo(
    () => Math.max(320, Math.min(Dimensions.get('window').width - 32, 520)),
    []
  );

  const { color, levelLabel } = useMemo(() => {
    const d = getDensityLevel(selectedCount ?? 0);
    return { color: d.color, levelLabel: d.label };
  }, [selectedCount]);

  const heroDensityLine = useMemo(() => {
    if (dateDataKind === 'prediction') return `Tahmini yoğunluk · ${levelLabel}`;
    if (dateDataKind === 'actual') return `Gerçek yoğunluk · ${levelLabel}`;
    return levelLabel;
  }, [dateDataKind, levelLabel]);

  const isPrediction = dateDataKind === 'prediction';
  const hasStationHourly = stationHourlyRows.length > 0;

  // Kapasite uyarısı: 75% warn, 90% critical, 100%+ over
  const capacityInfo = useMemo(() => {
    if (selectedCount == null || selectedCount <= 0) return null;
    const ratio = selectedCount / TRAM_CAPACITY;
    if (ratio >= 1.0) return { ratio, level: 'over' as const, pct: Math.round(ratio * 100) };
    if (ratio >= 0.9) return { ratio, level: 'critical' as const, pct: Math.round(ratio * 100) };
    if (ratio >= 0.75) return { ratio, level: 'warn' as const, pct: Math.round(ratio * 100) };
    return null;
  }, [selectedCount]);

  // Seçilen saatin bağlam faktörleri (yalnızca tahmin modunda)
  const contextFactors = useMemo(() => {
    if (!isPrediction) return null;
    const row = passengerRows.find(
      (r) => r.durakId === effectiveDurakId && r.saat === saat && r.dataType === 'prediction'
    );
    if (!row) return null;
    const factors = row.mainFactors ?? [];
    const weatherLevel = row.weatherImpactLevel ?? 'NONE';
    if (factors.length === 0 && weatherLevel === 'NONE') return null;
    return { factors, weatherLevel, weatherScore: row.weatherImpactScore ?? 0 };
  }, [passengerRows, effectiveDurakId, saat, isPrediction]);

  // Seçilen saat dilimindeki high confidence tahmini geçişler (max 6).
  // T1/T2/T3/T4 hatlarının tamamı high confidence olduğundan tüm kalibre edilmiş hatlar dahil edilir.
  const estimatedPassages = useMemo(() => {
    const [y, mo, d] = tarih.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    return getEstimatedStationPassages({ stationId: durakId, date, hour: saat })
      .filter((p) => p.confidence === 'high')
      .slice(0, 6);
  }, [durakId, tarih, saat]);

  // Saatlik yolcu toplamını tahmini geçişlere dağıt
  // selectedCount: hero'da gösterilen değer — parent görünümünde _G+_D toplamı, doğrudan durağa kendi sayısı
  const distributedPassages = useMemo(
    () =>
      distributeHourlyPassengersToPassages({
        hourlyPassengerCount: selectedCount ?? 0,
        passages: estimatedPassages,
      }),
    [selectedCount, estimatedPassages],
  );

  // Akıllı seyahat önerisi — useMemo hook'u guard'dan önce çağrılmalı (Hook kuralı)
  const travelRec = useMemo(() => {
    // dateDataKind 'none' olabilir; pipeline 'actual' | 'prediction' bekliyor
    const resolvedDataType =
      dateDataKind === 'prediction' ? 'prediction' : 'actual' as const;
    const predLabel = resolvedDataType === 'prediction' ? getPredictionConfidence(tarih) : null;
    return runUserRecommendationPipeline({
      stationId: durakId,
      stationName: station?.durakAd ?? '',
      selectedDate: tarih,
      selectedHour: saat,
      hourlyPassengerCount: selectedCount ?? 0,
      densityLevel: levelLabel,
      densityRank: getDensityRank(levelLabel),
      estimatedPassages,
      distributedPassages,
      nearbyStationsDensity: [],
      dataType: resolvedDataType,
      predictionConfidence: mapPredictionConfidence(predLabel),
      serviceDayType: getServiceDayType(tarih),
      isParentView,
    });
  }, [
    durakId,
    station,
    tarih,
    saat,
    selectedCount,
    levelLabel,
    estimatedPassages,
    distributedPassages,
    dateDataKind,
    isParentView,
  ]);

  if (!station) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.err}>Durak bulunamadı.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Geri</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const detailConfidence = dateDataKind === 'prediction' ? getPredictionConfidence(tarih) : null;

  const platformNote = isParentView ? ' · Gidiş + Dönüş toplamı' : '';
  const yolcuLine =
    isPrediction
      ? `Tahmini yolcu (seçilen saat)${platformNote}`
      : dateDataKind === 'actual'
        ? `Gerçek yolcu (seçilen saat)${platformNote}`
        : `Yolcu (seçilen saat)${platformNote}`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Geri</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.name}>{station.durakAd}</Text>
          {station.approximate ? <Text style={styles.warn}>Haritada yaklaşık konum kullanılıyor</Text> : null}
          <Text style={styles.heroMetaLine}>
            {formatDisplayDate(tarih)} · {String(saat).padStart(2, '0')}:00
          </Text>
          <Text style={styles.heroYolcu}>
            <Text style={styles.heroYolcuLabel}>{yolcuLine}</Text>
            {'\n'}
            <Text style={styles.heroYolcuVal}>{(selectedCount ?? 0).toLocaleString('tr-TR')}</Text>
            <Text style={styles.heroYolcuUnit}> yolcu</Text>
          </Text>
          {isParentView && childStations.length > 0 ? (
            <View style={styles.platformRow}>
              {childStations.map((child) => {
                const childCount = getPassengerCountByStationDateHour(passengerRows, child.durakId, tarih, saat);
                return (
                  <Text key={child.durakId} style={styles.platformItem}>
                    {child.direction === 'gidis' ? '↑ Gidiş' : '↓ Dönüş'}: {(childCount ?? 0).toLocaleString('tr-TR')} yolcu
                  </Text>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.badge, { borderColor: color }]}>
            <View style={[styles.badgeDot, { backgroundColor: color }]} />
            <Text style={styles.badgeText}>{heroDensityLine}</Text>
          </View>
        </View>

        {capacityInfo != null ? (
          <View style={[
            styles.capacityBanner,
            { borderColor: capacityInfo.level === 'over' ? '#ef4444' : capacityInfo.level === 'critical' ? '#f97316' : '#eab308' },
          ]}>
            <Text style={styles.capacityTitle}>
              {capacityInfo.level === 'over'
                ? 'Kapasite aşıldı'
                : capacityInfo.level === 'critical'
                  ? 'Tramvay neredeyse dolu'
                  : 'Yoğun doluluk'}
              {' · '}%{capacityInfo.pct}
            </Text>
            <Text style={styles.capacityBody}>
              {capacityInfo.level === 'over'
                ? 'Bu saatte tramvay kapasitesinin üzerinde yolcu bekleniyor. Bir sonraki seferi değerlendirin.'
                : capacityInfo.level === 'critical'
                  ? 'Tramvay kapasitesine çok yakın. Bir sonraki tramvayı beklemeyi düşünebilirsiniz.'
                  : 'Doluluk oranı yüksek. Mümkünse farklı bir saat tercih edin.'}
            </Text>
          </View>
        ) : null}

        {!hasStationHourly ? (
          <>
            <View style={styles.insightCard}>
              <Text style={styles.cardTitle}>En uygun saat</Text>
              <Text style={styles.mutedP}>Bu durak için yeterli veri yok</Text>
            </View>
            <View style={styles.insightCard}>
              <Text style={styles.cardTitle}>Şimdi gitmeli miyim?</Text>
              <Text style={styles.mutedP}>Bu durak için yeterli veri yok</Text>
            </View>
            <View style={styles.insightCard}>
              <Text style={styles.cardTitle}>Saatlik yoğunluk trendi</Text>
              <Text style={styles.mutedP}>Bu durak için yeterli veri yok</Text>
            </View>
          </>
        ) : null}

        {hasStationHourly ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>
              {isPrediction ? 'Tahmine göre en sakin saatler' : 'En sakin saatler'}
            </Text>
            <View style={styles.periodRow}>
              {(
                [
                  { key: 'sabah', label: 'Sabah', sub: '06–11', data: periodBestHours.sabah },
                  { key: 'oglen', label: 'Öğlen', sub: '12–16', data: periodBestHours.oglen },
                  { key: 'aksam', label: 'Akşam', sub: '17–22', data: periodBestHours.aksam },
                ] as const
              ).map(({ key, label, sub, data }) => (
                <View key={key} style={styles.periodCol}>
                  <Text style={styles.periodLabel}>{label}</Text>
                  <Text style={styles.periodSub}>{sub}</Text>
                  {data != null ? (
                    <>
                      <Text style={styles.periodHour}>
                        {String(data.hour).padStart(2, '0')}:00
                      </Text>
                      <Text style={styles.periodCount}>
                        {data.passengerCount.toLocaleString('tr-TR')} yolcu
                      </Text>
                      <Text style={[styles.periodDensity, { color: getDensityLevel(data.passengerCount).color }]}>
                        {data.densityLabel}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.periodNoData}>Veri yok</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {hasStationHourly ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>Şimdi gitmeli miyim?</Text>
            <Text style={styles.cardEm}>{goRec.message}</Text>
            {goRec.current != null ? (
              <Text style={styles.cardP}>
                Şu an: {goRec.current.passengerCount.toLocaleString('tr-TR')} yolcu · {goRec.current.densityLabel}
              </Text>
            ) : null}
            {goRec.next != null ? (
              <Text style={styles.cardP}>
                Sonraki saat: {goRec.next.passengerCount.toLocaleString('tr-TR')} yolcu · {goRec.next.densityLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {distributedPassages.length > 0 ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>Seçilen saat dilimindeki tahmini geçişler</Text>
            {distributedPassages.map((p, i) => (
              <Text key={i} style={styles.passageRow}>
                {p.estimatedPassageTime}{'  ·  '}{p.lineId} {p.direction === 'gidis' ? 'Gidiş' : 'Dönüş'}{'  ·  '}~{p.estimatedPassengers.toLocaleString('tr-TR')} yolcu
              </Text>
            ))}
            <Text style={styles.passageNote}>
              Saatlik yoğunluk tahmini, sefer çizelgesine göre tahmini geçişlere dağıtılmıştır. Gerçek zamanlı konum değildir.
            </Text>
          </View>
        ) : null}

        {dateDataKind !== 'none' && travelRec.action !== 'no_data' ? (
          <View style={styles.travelRecCard}>
            <Text style={styles.cardTitle}>Akıllı seyahat önerisi</Text>
            <Text style={styles.cardEm}>{travelRec.headline}</Text>
            <Text style={styles.cardP}>{travelRec.detail}</Text>
            {travelRec.recommendedPassageTime != null ? (
              <Text style={styles.cardP}>
                Önerilen geçiş: {travelRec.recommendedPassageTime} civarı
              </Text>
            ) : null}
            <Text style={styles.passageNote}>{travelRec.explanation}</Text>
          </View>
        ) : null}

        {contextFactors != null ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>Tahmin Faktörleri</Text>
            {contextFactors.factors.length > 0 ? (
              <View style={styles.factorRow}>
                {contextFactors.factors.map((f) => (
                  <View key={f} style={styles.factorTag}>
                    <Text style={styles.factorTagText}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {contextFactors.weatherLevel !== 'NONE' ? (
              <View style={[
                styles.weatherBadge,
                { backgroundColor: contextFactors.weatherLevel === 'CRITICAL' || contextFactors.weatherLevel === 'HIGH' ? '#ef4444' : '#f97316' },
              ]}>
                <Text style={styles.weatherBadgeText}>
                  Hava etkisi · {contextFactors.weatherLevel} · %{Math.round(contextFactors.weatherScore * 100)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {hasStationHourly ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>Saatlik yoğunluk trendi</Text>
            {hasTrendGaps ? (
              <Text style={styles.gapNote}>
                Bazı saatlerde kayıt yok; çizgi yalnızca veri bulunan saatleri bağlar.
              </Text>
            ) : null}
            {trendHighlightIndex >= 0 && trendChart.data.length > 0 ? (
              <Text style={styles.chartHint}>
                Vurgu: {String(saat).padStart(2, '0')}:00
              </Text>
            ) : null}
            {trendChart.data.length === 0 ? (
              <Text style={styles.mutedP}>
                05:00–23:00 arasında bu durağa ait yolcu kaydı yok; grafik gösterilemiyor.
              </Text>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.trendScrollInner}
              >
                <LineChart
                  data={{
                    labels: trendChart.labels,
                    datasets: [{ data: trendChart.data }],
                  }}
                  width={chartWidth}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=""
                  fromZero
                  withInnerLines
                  withOuterLines
                  withVerticalLines={false}
                  chartConfig={{
                    backgroundGradientFrom: theme.surface,
                    backgroundGradientTo: theme.surfaceElevated,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    labelColor: () => theme.textMuted,
                    propsForDots: { r: '4' },
                    propsForBackgroundLines: {
                      stroke: theme.border,
                      strokeDasharray: '0',
                    },
                  }}
                  style={styles.lineChart}
                  bezier
                  getDotColor={(_p, i) => (i === trendHighlightIndex ? theme.accent : 'transparent')}
                />
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.grid}>
          {detailConfidence != null ? (
            <StatCard
              title="Güven (ML tahmin)"
              value={detailConfidence}
              subtitle="Gelecekteki günler için belirsizlik artar"
            />
          ) : null}
          <StatCard
            title="Günlük toplam"
            value={dailyTotal.toLocaleString('tr-TR')}
            subtitle={formatDisplayDate(tarih)}
          />
          <StatCard title="Günlük ortalama (saat başı)" value={Math.round(avg).toLocaleString('tr-TR')} />
          <StatCard
            title="En yoğun saat"
            value={busiestHour != null ? `${String(busiestHour).padStart(2, '0')}:00` : '—'}
          />
        </View>

        <PassengerChart points={hourly} highlightHour={busiestHour} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { color: theme.textPrimary, fontSize: 16, marginBottom: 12 },
  backBtn: { backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  backText: { color: '#fff', fontWeight: '700' },
  backLink: { alignSelf: 'flex-start', marginBottom: 4 },
  backLinkText: { color: theme.textSecondary, fontWeight: '700' },
  hero: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  name: { color: theme.textPrimary, fontSize: 20, fontWeight: '800' },
  warn: { color: theme.textMuted, marginTop: 6, fontSize: 12 },
  badge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surfaceElevated,
  },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  badgeText: { color: theme.textPrimary, fontWeight: '800' },
  heroMetaLine: { color: theme.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 6 },
  heroYolcu: { marginTop: 10 },
  heroYolcuLabel: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
  heroYolcuVal: { color: theme.textPrimary, fontSize: 24, fontWeight: '800' },
  heroYolcuUnit: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
  insightCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
    gap: 6,
  },
  cardTitle: { color: theme.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  cardEm: { color: theme.textPrimary, fontSize: 16, fontWeight: '800' },
  cardP: { color: theme.textPrimary, fontSize: 14, fontWeight: '500' },
  mutedP: { color: theme.textMuted, fontSize: 14, lineHeight: 20 },
  chartHint: { color: theme.accent, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  gapNote: { color: theme.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  trendScrollInner: { paddingVertical: 4, paddingRight: 8 },
  lineChart: { borderRadius: theme.cardRadius, marginVertical: 4 },
  grid: { gap: 12 },
  platformRow: { marginTop: 6, gap: 2 },
  platformItem: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  capacityBanner: {
    borderRadius: theme.cardRadius,
    borderWidth: 1.5,
    padding: 14,
    gap: 6,
    backgroundColor: theme.surface,
  },
  capacityTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '800' },
  capacityBody: { color: theme.textSecondary, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  factorTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.border,
  },
  factorTagText: { color: theme.textPrimary, fontSize: 12, fontWeight: '600' },
  factorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  weatherBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  weatherBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  periodRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  periodCol: {
    flex: 1,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 10,
    padding: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: '700' },
  periodSub: { color: theme.textMuted, fontSize: 10, fontWeight: '500', marginBottom: 4 },
  periodHour: { color: theme.textPrimary, fontSize: 18, fontWeight: '800' },
  periodCount: { color: theme.textSecondary, fontSize: 11, fontWeight: '500' },
  periodDensity: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  periodNoData: { color: theme.textMuted, fontSize: 12, fontWeight: '500', marginTop: 4 },
  passageRow: { color: theme.textPrimary, fontSize: 13, fontWeight: '700' },
  passageNote: { color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  travelRecCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1.5,
    borderColor: theme.accent,
    ...theme.shadow,
    gap: 6,
  },
});
