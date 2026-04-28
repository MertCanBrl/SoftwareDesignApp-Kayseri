import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PassengerChart } from '../components/PassengerChart';
import { StatCard } from '../components/StatCard';
import { theme } from '../constants/theme';
import { getDensityLevel } from '../constants/densityLevels';
import { useSelection } from '../context/SelectionContext';
import { formatDisplayDate } from '../utils/date';
import { getPredictionConfidence } from '../utils/predictionConfidence';
import {
  getBestHourForStation,
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

export function StationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ durakId: string; tarih?: string; saat?: string }>();
  const {
    passengerRows,
    stations,
    tarih: ctxTarih,
    saat: ctxSaat,
    setTarih,
    dateDataKind,
  } = useSelection();

  const durakId = String(params.durakId ?? '');
  const tarih = typeof params.tarih === 'string' && params.tarih ? params.tarih : ctxTarih;
  const saat = params.saat != null ? Number(params.saat) : ctxSaat;

  useEffect(() => {
    if (typeof params.tarih === 'string' && params.tarih && params.tarih !== ctxTarih) {
      setTarih(params.tarih);
    }
  }, [params.tarih, ctxTarih, setTarih]);

  const station = useMemo(() => stations.find((s) => s.durakId === durakId), [stations, durakId]);

  const hourly = useMemo(() => getDailyStationData(passengerRows, durakId, tarih), [passengerRows, durakId, tarih]);
  const busiestHour = useMemo(() => getBusiestHour(hourly), [hourly]);

  const dailyTotal = useMemo(() => hourly.reduce((s, p) => s + p.yolcuSayisi, 0), [hourly]);
  const avg = useMemo(
    () => (hourly.length ? dailyTotal / hourly.length : 0),
    [dailyTotal, hourly.length]
  );

  const selectedCount = useMemo(
    () => getPassengerCountByStationDateHour(passengerRows, durakId, tarih, saat),
    [passengerRows, durakId, tarih, saat]
  );

  const stationHourlyRows = useMemo(
    () => getStationHourlyRows(passengerRows, durakId),
    [passengerRows, durakId]
  );
  const bestHour = useMemo(
    () => getBestHourForStation(passengerRows, durakId),
    [passengerRows, durakId]
  );
  const goRec = useMemo(
    () => getCurrentAndNextRecommendation(passengerRows, durakId, saat),
    [passengerRows, durakId, saat]
  );
  const trendData = useMemo(
    () => getHourlyTrendData(passengerRows, durakId),
    [passengerRows, durakId]
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

  const yolcuLine =
    isPrediction
      ? 'Tahmini yolcu (seçilen saat)'
      : dateDataKind === 'actual'
        ? 'Gerçek yolcu (seçilen saat)'
        : 'Yolcu (seçilen saat)';

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
          <View style={[styles.badge, { borderColor: color }]}>
            <View style={[styles.badgeDot, { backgroundColor: color }]} />
            <Text style={styles.badgeText}>{heroDensityLine}</Text>
          </View>
        </View>

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

        {hasStationHourly && bestHour != null ? (
          <View style={styles.insightCard}>
            <Text style={styles.cardTitle}>En uygun saat</Text>
            <Text style={styles.cardEm}>
              {isPrediction
                ? `Tahmine göre en uygun saat: ${String(bestHour.hour).padStart(2, '0')}:00`
                : `Seçili gün verisine göre en sakin saat: ${String(bestHour.hour).padStart(2, '0')}:00`}
            </Text>
            <Text style={styles.cardP}>
              {isPrediction ? 'Tahmin edilen yolcu' : 'Yolcu'}: {bestHour.passengerCount.toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.cardP}>Yoğunluk: {bestHour.densityLabel}</Text>
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
});
