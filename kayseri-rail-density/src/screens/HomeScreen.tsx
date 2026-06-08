import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import { useAuth } from '../auth/AuthContext';
import { getDensityLevel } from '../constants/densityLevels';
import { formatDisplayDate } from '../utils/date';

const BAR_MAX_H = 52;

export function HomeScreen() {
  const { passengerRows, tarih, saat, dateDataKind } = useSelection();
  const { isAdmin, logout } = useAuth();

  function handleLogout() {
    logout();
    Alert.alert('Çıkış yapıldı', 'Misafir moduna geçildi.');
  }

  const isPrediction = dateDataKind === 'prediction';

  // ── Mevcut saatteki ağ verileri ───────────────────────────────────────────
  const currentHourRows = useMemo(
    () => passengerRows.filter((r) => r.saat === saat),
    [passengerRows, saat]
  );

  const totalNow = useMemo(
    () => currentHourRows.reduce((s, r) => s + r.yolcuSayisi, 0),
    [currentHourRows]
  );

  const activeStations = useMemo(
    () => new Set(currentHourRows.filter((r) => r.yolcuSayisi > 0).map((r) => r.durakId)).size,
    [currentHourRows]
  );

  // Ağ genelinde ortalama durak yoğunluğu
  const avgPerStation = activeStations > 0 ? totalNow / activeStations : 0;
  const networkDensity = getDensityLevel(Math.round(avgPerStation));

  // ── En kalabalık duraklar (şu an) ─────────────────────────────────────────
  const topStations = useMemo(
    () => [...currentHourRows].sort((a, b) => b.yolcuSayisi - a.yolcuSayisi).slice(0, 5),
    [currentHourRows]
  );

  // ── Saatlik toplam yoğunluk (bar grafik) ──────────────────────────────────
  const hourlyTotals = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of passengerRows) m.set(r.saat, (m.get(r.saat) ?? 0) + r.yolcuSayisi);
    return Array.from({ length: 24 }, (_, h) => m.get(h) ?? 0);
  }, [passengerRows]);

  const maxHourly = useMemo(() => Math.max(...hourlyTotals, 1), [hourlyTotals]);

  const peakHour = useMemo(
    () => hourlyTotals.reduce((best, v, h) => (v > hourlyTotals[best]! ? h : best), 0),
    [hourlyTotals]
  );

  const hasData = passengerRows.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.brandRow}>
              <View style={[styles.networkDot, { backgroundColor: networkDensity.color }]} />
              <Text style={styles.brand}>Kayseri Tramvay</Text>
            </View>
            {isPrediction && (
              <View style={styles.predBadge}>
                <Text style={styles.predBadgeText}>ML Tahmin</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroDate}>{formatDisplayDate(tarih)}</Text>
          <View style={styles.heroTimeRow}>
            <Text style={styles.heroTime}>{String(saat).padStart(2, '0')}:00</Text>
            <View style={[styles.densityPill, { borderColor: networkDensity.color + '70' }]}>
              <View style={[styles.densityDot, { backgroundColor: networkDensity.color }]} />
              <Text style={styles.densityText}>{networkDensity.label}</Text>
            </View>
          </View>
        </View>

        {/* ── İstatistik row ─────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxLeft]}>
            <Text style={styles.statValue}>
              {hasData ? totalNow.toLocaleString('tr-TR') : '—'}
            </Text>
            <Text style={styles.statLabel}>Bu saat yolcu</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{hasData ? activeStations : '—'}</Text>
            <Text style={styles.statLabel}>Aktif durak</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRight]}>
            <Text style={styles.statValue}>
              {hasData ? `${String(peakHour).padStart(2, '0')}:00` : '—'}
            </Text>
            <Text style={styles.statLabel}>En yoğun saat</Text>
          </View>
        </View>

        {/* ── Şu An En Kalabalık ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Şu An En Kalabalık</Text>
          {!hasData || topStations.length === 0 ? (
            <Text style={styles.empty}>Bu saat için veri bulunamadı</Text>
          ) : (
            topStations.map((row, i) => {
              const density = getDensityLevel(row.yolcuSayisi);
              const maxInList = topStations[0]?.yolcuSayisi ?? 1;
              const barWidthPct = Math.max(8, (row.yolcuSayisi / maxInList) * 100);
              return (
                <Pressable
                  key={row.durakId}
                  style={({ pressed }) => [styles.stationRow, pressed && styles.rowPressed]}
                  onPress={() =>
                    router.push(
                      `/station/${encodeURIComponent(row.durakId)}?tarih=${encodeURIComponent(tarih)}&saat=${encodeURIComponent(String(saat))}`
                    )
                  }
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stationMeta}>
                    <View style={styles.stationNameRow}>
                      <Text style={styles.stationName} numberOfLines={1}>
                        {row.durakAd}
                      </Text>
                      <Text style={styles.stationCount}>
                        {row.yolcuSayisi.toLocaleString('tr-TR')}
                      </Text>
                    </View>
                    <View style={styles.stationBarTrack}>
                      <View
                        style={[
                          styles.stationBar,
                          { width: `${barWidthPct}%` as const, backgroundColor: density.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.stationDensityLabel}>{density.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Saatlik Yoğunluk Grafiği ───────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bugünkü Saatlik Yoğunluk</Text>
          {!hasData ? (
            <Text style={styles.empty}>Veri bulunamadı</Text>
          ) : (
            <View style={styles.barsWrap}>
              {hourlyTotals.map((total, h) => {
                const isActive = h === saat;
                const isPeak = h === peakHour && total > 0;
                const barH = total > 0 ? Math.max(3, (total / maxHourly) * BAR_MAX_H) : 2;
                const barColor = isActive
                  ? theme.accent
                  : isPeak
                    ? '#F28A3D'
                    : total > 0
                      ? theme.border
                      : theme.border + '50';
                return (
                  <View key={h} style={styles.barSlot}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: barH, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    {h % 4 === 0 ? (
                      <Text style={[styles.barLabel, isActive && styles.barLabelActive]}>
                        {String(h).padStart(2, '0')}
                      </Text>
                    ) : (
                      <View style={styles.barLabelSpace} />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.barLegend}>
            <View style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: theme.accent }]} />
              <Text style={styles.barLegendText}>Şu an</Text>
            </View>
            <View style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: '#F28A3D' }]} />
              <Text style={styles.barLegendText}>Zirve saat</Text>
            </View>
          </View>
        </View>

        {/* ── Aksiyon butonları ──────────────────────────────────────── */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/map')}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        >
          <Ionicons name="map-outline" size={18} color="#fff" style={styles.btnIcon} />
          <Text style={styles.primaryBtnText}>Haritayı Aç</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/statistics')}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
        >
          <Ionicons name="bar-chart-outline" size={17} color={theme.textPrimary} style={styles.btnIcon} />
          <Text style={styles.secondaryBtnText}>İstatistikleri Gör</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/about')}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.ghostBtnText}>Proje Hakkında</Text>
        </Pressable>

        {/* ── Alt bilgi + yönetici butonu ────────────────────────── */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={13} color={theme.textMuted} />
          <Text style={styles.footerText}>
            {isPrediction
              ? 'Gösterilen veriler ML modeli tahminleridir.'
              : 'Gösterilen veriler gerçek yolcu kayıtlarıdır.'}
            {' '}Canlı bağlantı kullanılmaz.
          </Text>
        </View>

        {isAdmin && (
          <View style={styles.adminBar}>
            <Ionicons name="shield-checkmark" size={13} color="#22c55e" />
            <Text style={styles.adminBarText}>Yönetici modu</Text>
            <Pressable onPress={handleLogout} style={styles.adminLogoutBtn}>
              <Text style={styles.adminLogoutText}>Çıkış</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  // Hero
  hero: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
    gap: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  networkDot: { width: 10, height: 10, borderRadius: 5 },
  brand: { color: theme.textPrimary, fontSize: 17, fontWeight: '800' },
  predBadge: {
    backgroundColor: theme.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.accent + '50',
  },
  predBadgeText: { color: theme.accent, fontSize: 11, fontWeight: '700' },
  heroDate: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  heroTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  heroTime: { color: theme.textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  densityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.surfaceElevated,
  },
  densityDot: { width: 8, height: 8, borderRadius: 4 },
  densityText: { color: theme.textPrimary, fontSize: 13, fontWeight: '700' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  statBoxLeft: { borderTopLeftRadius: theme.cardRadius, borderBottomLeftRadius: theme.cardRadius },
  statBoxRight: { borderTopRightRadius: theme.cardRadius, borderBottomRightRadius: theme.cardRadius },
  statValue: { color: theme.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 13,
  },

  // Card
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
    gap: 8,
  },
  cardTitle: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  empty: { color: theme.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  // Station rows
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  rowPressed: { opacity: 0.8 },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: theme.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  rankText: { color: theme.textSecondary, fontSize: 11, fontWeight: '800' },
  stationMeta: { flex: 1, gap: 4 },
  stationNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stationName: { color: theme.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  stationCount: { color: theme.textPrimary, fontSize: 13, fontWeight: '800', marginLeft: 8 },
  stationBarTrack: {
    height: 4,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  stationBar: { height: 4, borderRadius: 2 },
  stationDensityLabel: { color: theme.textMuted, fontSize: 11, fontWeight: '500' },

  // Hourly bar chart
  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_MAX_H + 18,
    gap: 2,
    marginTop: 4,
  },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: BAR_MAX_H + 18 },
  barTrack: { width: '100%', justifyContent: 'flex-end', flex: 1 },
  bar: { width: '100%', borderRadius: 2 },
  barLabel: { color: theme.textMuted, fontSize: 8, marginTop: 2, fontWeight: '600' },
  barLabelActive: { color: theme.accent },
  barLabelSpace: { height: 10 },
  barLegend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  barLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLegendDot: { width: 8, height: 8, borderRadius: 4 },
  barLegendText: { color: theme.textMuted, fontSize: 11 },

  // Action buttons
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 15,
    borderRadius: theme.cardRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: theme.surface,
    paddingVertical: 15,
    borderRadius: theme.cardRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryBtnText: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
  btnPressed: { opacity: 0.85 },
  btnIcon: {},

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
  },
  footerText: { color: theme.textMuted, fontSize: 11, lineHeight: 16, flex: 1 },

  // Admin bar
  adminBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 12,
  },
  adminBarText: { color: '#22c55e', fontSize: 12, fontWeight: '600', flex: 1 },
  adminLogoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  adminLogoutText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
});
