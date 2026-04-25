import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PassengerChart } from '../components/PassengerChart';
import { StatCard } from '../components/StatCard';
import { theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import {
  calculatePercentiles,
  getDensityColor,
  getDensityLabel,
  getDensityLevel,
  percentileRank01,
} from '../utils/density';
import { formatDisplayDate } from '../utils/date';
import {
  getBusiestHour,
  getDailyStationData,
  getPassengerCountByStationDateHour,
} from '../utils/statistics';

export function StationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ durakId: string; tarih?: string; saat?: string }>();
  const { passengerRows, stations, tarih: ctxTarih, saat: ctxSaat } = useSelection();

  const durakId = String(params.durakId ?? '');
  const tarih = typeof params.tarih === 'string' && params.tarih ? params.tarih : ctxTarih;
  const saat = params.saat != null ? Number(params.saat) : ctxSaat;

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

  const { color, levelLabel } = useMemo(() => {
    const slice = passengerRows
      .filter((r) => r.tarih === tarih && r.saat === saat)
      .map((r) => r.yolcuSayisi)
      .sort((a, b) => a - b);
    const qs = calculatePercentiles(slice);
    const val = selectedCount ?? 0;
    if (!qs) {
      return { color: getDensityColor(0.5), levelLabel: getDensityLabel('low') };
    }
    const pr = percentileRank01(val, slice);
    const level = getDensityLevel(val, qs);
    return { color: getDensityColor(pr), levelLabel: getDensityLabel(level) };
  }, [passengerRows, tarih, saat, selectedCount]);

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Geri</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.name}>{station.durakAd}</Text>
          {station.approximate ? <Text style={styles.warn}>Haritada yaklaşık konum kullanılıyor</Text> : null}
          <View style={[styles.badge, { borderColor: color }]}>
            <View style={[styles.badgeDot, { backgroundColor: color }]} />
            <Text style={styles.badgeText}>{levelLabel}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <StatCard
            title="Seçilen saatte yolcu"
            value={(selectedCount ?? 0).toLocaleString('tr-TR')}
            subtitle={`${formatDisplayDate(tarih)} · ${String(saat).padStart(2, '0')}:00`}
          />
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
  grid: { gap: 12 },
});
