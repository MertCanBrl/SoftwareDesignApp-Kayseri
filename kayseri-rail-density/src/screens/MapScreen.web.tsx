/**
 * Web platform stub for MapScreen.
 * react-native-maps is not supported on web; this renders a station list instead.
 */
/**
 * Web platform stub for MapScreen.
 * react-native-maps is not supported on web; this renders a station list instead.
 */
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { DensityLegend } from '../components/DensityLegend';
import { theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import { useAuth } from '../auth/AuthContext';
import { LoginModal } from '../auth/LoginModal';
import { getDensityLevel } from '../constants/densityLevels';
import { getPassengerRowByStationDateHour } from '../utils/statistics';

function trIncludes(hay: string, needle: string): boolean {
  return hay.toLocaleLowerCase('tr-TR').includes(needle.toLocaleLowerCase('tr-TR').trim());
}

export function MapScreen() {
  const { isAdmin } = useAuth();
  const [loginVisible, setLoginVisible] = useState(false);

  const {
    passengerRows,
    stations,
    sortedDates,
    tarih,
    saat,
    minute,
    setTarih,
    setSaat,
    setMinute,
    dateDataKind,
    markPredictionOnlyDates,
    minAllowedSaat,
    minAllowedMinute,
  } = useSelection();

  const [searchQuery, setSearchQuery] = useState('');

  const yolcuTitle =
    dateDataKind === 'prediction' ? 'Tahmini Yolcu' : dateDataKind === 'actual' ? 'Gerçek Yolcu' : 'Yolcu';

  const stationRows = useMemo(() => {
    const q = searchQuery.trim();
    return stations
      .filter((s) => !q || trIncludes(s.durakAd, q))
      .map((s) => {
        const row = getPassengerRowByStationDateHour(passengerRows, s.durakId, tarih, saat);
        const yolcu = row?.yolcuSayisi ?? 0;
        const density = getDensityLevel(yolcu);
        return { station: s, yolcu, density };
      })
      .sort((a, b) => b.yolcu - a.yolcu);
  }, [stations, passengerRows, tarih, saat, searchQuery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Harita</Text>
          <Pressable
            onPress={() => isAdmin ? router.push('/municipality-dashboard') : setLoginVisible(true)}
            style={[styles.hiddenLoginBtn, isAdmin && styles.adminBtn]}
            accessibilityLabel={isAdmin ? 'Yönetici paneli' : 'Yönetici girişi'}
          >
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'lock-closed'}
              size={isAdmin ? 18 : 14}
              color={isAdmin ? '#22c55e' : theme.textMuted}
            />
            {isAdmin ? <Text style={styles.adminBtnLabel}>Panel</Text> : null}
          </Pressable>
        </View>
        <View style={styles.webNote}>
          <Ionicons name="information-circle-outline" size={15} color={theme.textMuted} />
          <Text style={styles.webNoteText}>
            Harita görünümü yalnızca mobil uygulamada kullanılabilir.
          </Text>
        </View>
        <DateTimeSelector
          sortedDates={sortedDates}
          tarih={tarih}
          saat={saat}
          minute={minute}
          onChangeDate={setTarih}
          onChangeTime={(h, m) => { setSaat(h); setMinute(m); }}
          predictionOnlyDates={markPredictionOnlyDates}
          minHour={minAllowedSaat}
          minMinute={minAllowedMinute}
        />
        <View style={styles.legendPad}>
          <DensityLegend />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Durak ara…"
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={stationRows}
        keyExtractor={(item) => item.station.durakId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(
                `/station/${encodeURIComponent(item.station.durakId)}?tarih=${encodeURIComponent(tarih)}&saat=${encodeURIComponent(String(saat))}`
              )
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={[styles.dot, { backgroundColor: item.density.color }]} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.station.durakAd}
              </Text>
              <Text style={styles.rowDensity}>{item.density.label}</Text>
            </View>
            <Text style={styles.rowCount}>
              {item.yolcu.toLocaleString('tr-TR')}
              <Text style={styles.rowCountLabel}> {yolcuTitle.toLowerCase()}</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Eşleşen durak bulunamadı</Text>
        }
      />

      <LoginModal
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  hiddenLoginBtn: {
    padding: 6,
    opacity: 0.4,
  },
  adminBtn: {
    opacity: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminBtnLabel: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  webNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  webNoteText: {
    color: theme.textMuted,
    fontSize: 12,
  },
  legendPad: { marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingLeft: 10,
    paddingRight: 8,
    minHeight: 40,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
    outlineStyle: 'none',
  } as ReturnType<typeof StyleSheet.create>[string],
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: theme.background,
  },
  rowPressed: { backgroundColor: theme.surface },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowInfo: { flex: 1 },
  rowName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  rowDensity: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  rowCount: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  rowCountLabel: { color: theme.textMuted, fontWeight: '400', fontSize: 12 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
  empty: {
    padding: 24,
    color: theme.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
});
