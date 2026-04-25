import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StatCard } from '../components/StatCard';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import { formatDisplayDate } from '../utils/date';
import { getDailySummary } from '../utils/statistics';

export function StatisticsScreen() {
  const { passengerRows, sortedDates, tarih, setTarih, saat, setSaat } = useSelection();

  const summary = useMemo(() => getDailySummary(passengerRows, tarih), [passengerRows, tarih]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>İstatistikler</Text>
        <Text style={styles.lead}>Seçilen gün: {formatDisplayDate(tarih)}</Text>

        <DateTimeSelector
          sortedDates={sortedDates}
          tarih={tarih}
          saat={saat}
          onChangeDate={setTarih}
          onChangeHour={setSaat}
        />

        <View style={styles.grid}>
          <StatCard
            title="Toplam yolcu (gün)"
            value={summary.totalPassengers.toLocaleString('tr-TR')}
            subtitle="Seçilen tarihte tüm durak ve saatler toplamı"
          />
          <StatCard
            title="En yoğun saat"
            value={summary.busiestHour != null ? `${String(summary.busiestHour).padStart(2, '0')}:00` : '—'}
            subtitle="Gün içinde en yüksek toplam yolcu olan saat"
          />
          <StatCard
            title="Ortalama (kayıt başına)"
            value={Math.round(summary.averagePerRecord).toLocaleString('tr-TR')}
            subtitle="Toplam yolcu / kayıt sayısı"
          />
          <StatCard
            title="En yoğun durak"
            value={summary.busiestStation?.durakAd ?? '—'}
            subtitle={
              summary.busiestStation
                ? `${summary.busiestStation.total.toLocaleString('tr-TR')} yolcu (gün)`
                : undefined
            }
          />
          <StatCard
            title="En sakin durak"
            value={summary.calmestStation?.durakAd ?? '—'}
            subtitle={
              summary.calmestStation
                ? `${summary.calmestStation.total.toLocaleString('tr-TR')} yolcu (gün)`
                : undefined
            }
          />
        </View>

        <Text style={styles.section}>Günün ilk 5 durağı (toplam yolcu)</Text>
        <View style={styles.rank}>
          {summary.top5.map((s, i) => (
            <View key={s.durakId} style={styles.rankRow}>
              <View style={styles.rankNo}>
                <Text style={styles.rankNoText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankName}>{s.durakAd}</Text>
                <Text style={styles.rankMeta}>{s.total.toLocaleString('tr-TR')} yolcu</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  title: { color: theme.textPrimary, fontSize: 22, fontWeight: '800' },
  lead: { color: theme.textSecondary, fontSize: 14, marginBottom: 4 },
  grid: { gap: 12 },
  section: {
    marginTop: 8,
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  rank: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    gap: 10,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankNo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNoText: { color: theme.textPrimary, fontWeight: '800' },
  rankName: { color: theme.textPrimary, fontSize: 15, fontWeight: '700' },
  rankMeta: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
});
