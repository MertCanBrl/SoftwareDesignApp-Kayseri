import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, type MapMarker } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { DensityLegend } from '../components/DensityLegend';
import { StationMarker } from '../components/StationMarker';
import { KAYSERI_REGION, theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import { getDensityLevel } from '../constants/densityLevels';
import { getPredictionConfidence } from '../utils/predictionConfidence';
import { getMapCalloutShortRecommendation } from '../utils/recommendations';
import { getPassengerRowByStationDateHour } from '../utils/statistics';
import { haversineDistanceMeters } from '../utils/haversine';
import type { StationRecord } from '../types';

const STATION_ZOOM = { latitudeDelta: 0.012, longitudeDelta: 0.012 };
const USER_ZOOM = { latitudeDelta: 0.04, longitudeDelta: 0.04 };
const SEARCH_MAX_RESULTS = 40;
const SEARCH_DEBOUNCE_MS = 300;
const USER_ACCURACY_CIRCLE_M = 42;

/** Kullanıcının “yakın” sayılması için merkez (100 km içi) */
const KAYSERI_CENTER = {
  latitude: 38.7205,
  longitude: 35.4826,
} as const;

const KAYSERI_MAX_DISTANCE_M = 100_000;

function isLocationNearKayseri(position: { latitude: number; longitude: number }): boolean {
  const distanceM = haversineDistanceMeters(position, {
    latitude: KAYSERI_CENTER.latitude,
    longitude: KAYSERI_CENTER.longitude,
  });
  return distanceM <= KAYSERI_MAX_DISTANCE_M;
}

type NearestEntry = { station: StationRecord; distanceM: number };

function hasRealMapCoordinates(s: StationRecord): boolean {
  return s.approximate !== true;
}

function formatDistanceM(m: number): string {
  if (m < 1000) {
    return `${Math.round(m)} m`;
  }
  return `${(m / 1000).toFixed(1)} km`;
}

function trIncludes(hay: string, needle: string): boolean {
  const a = hay.toLocaleLowerCase('tr-TR');
  const b = needle.toLocaleLowerCase('tr-TR').trim();
  if (!b) return true;
  return a.includes(b);
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Record<string, MapMarker | null>>({});

  const {
    passengerRows,
    stations,
    sortedDates,
    tarih,
    saat,
    setTarih,
    setSaat,
    dateDataKind,
    markPredictionOnlyDates,
  } = useSelection();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userMapPosition, setUserMapPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showUserOnMap, setShowUserOnMap] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  const [nearestStations, setNearestStations] = useState<NearestEntry[]>([]);
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const yolcuCalloutTitle =
    dateDataKind === 'prediction' ? 'Tahmini Yolcu' : dateDataKind === 'actual' ? 'Gerçek Yolcu' : 'Yolcu';
  const densityCalloutTitle =
    dateDataKind === 'prediction'
      ? 'Tahmini Yoğunluk'
      : dateDataKind === 'actual'
        ? 'Gerçek Yoğunluk'
        : 'Yoğunluk';

  const countById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stations) {
      const row = getPassengerRowByStationDateHour(passengerRows, s.durakId, tarih, saat);
      m.set(s.durakId, row?.yolcuSayisi ?? 0);
    }
    return m;
  }, [passengerRows, stations, tarih, saat]);

  const mapConfidence = dateDataKind === 'prediction' ? getPredictionConfidence(tarih) : undefined;

  const calloutRecById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of stations) {
      m.set(
        s.durakId,
        getMapCalloutShortRecommendation(passengerRows, s.durakId, saat)
      );
    }
    return m;
  }, [passengerRows, stations, saat]);

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return [];
    return stations
      .filter((s) => trIncludes(s.durakAd, q))
      .slice(0, SEARCH_MAX_RESULTS);
  }, [debouncedSearch, stations]);

  const recomputeNearest = useCallback(
    (from: { latitude: number; longitude: number }) => {
      const withCoords = stations.filter(hasRealMapCoordinates);
      const ranked = withCoords
        .map((station) => ({
          station,
          distanceM: haversineDistanceMeters(
            { latitude: from.latitude, longitude: from.longitude },
            { latitude: station.latitude, longitude: station.longitude }
          ),
        }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 3);
      setNearestStations(ranked);
    },
    [stations]
  );

  const clearSearchBlurTimer = useCallback(() => {
    if (searchBlurTimer.current) {
      clearTimeout(searchBlurTimer.current);
      searchBlurTimer.current = null;
    }
  }, []);

  const focusOnStation = useCallback(
    (station: StationRecord) => {
      if (!hasRealMapCoordinates(station)) {
        Alert.alert('', 'Bu durak için koordinat bulunamadı');
        return;
      }
      setFocusedStationId(station.durakId);
      mapRef.current?.animateToRegion(
        {
          latitude: station.latitude,
          longitude: station.longitude,
          ...STATION_ZOOM,
        },
        450
      );
      setTimeout(() => {
        markerRefs.current[station.durakId]?.showCallout();
      }, 520);
    },
    []
  );

  const onPressMap = useCallback(() => {
    clearSearchBlurTimer();
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setFocusedStationId(null);
  }, [clearSearchBlurTimer]);

  const onPressMyLocation = useCallback(async () => {
    if (isLocationLoading) return;
    setIsLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', 'Konum izni verilmedi');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      const userPos = { latitude, longitude };

      if (!isLocationNearKayseri(userPos)) {
        setShowUserOnMap(false);
        setUserMapPosition(null);
        recomputeNearest({
          latitude: KAYSERI_CENTER.latitude,
          longitude: KAYSERI_CENTER.longitude,
        });
        mapRef.current?.animateToRegion(
          {
            latitude: KAYSERI_CENTER.latitude,
            longitude: KAYSERI_CENTER.longitude,
            ...USER_ZOOM,
          },
          500
        );
        Alert.alert(
          '',
          'Konum Kayseri dışında görünüyor. Simulator kullanıyorsanız Features > Location > Custom Location bölümünden Kayseri koordinatlarını girin. Şimdilik harita Kayseri merkezine alındı.'
        );
        return;
      }

      setShowUserOnMap(true);
      setUserMapPosition(userPos);
      recomputeNearest(userPos);
      mapRef.current?.animateToRegion({ ...userPos, ...USER_ZOOM }, 500);
    } catch {
      Alert.alert('', 'Konum alınamadı');
    } finally {
      setIsLocationLoading(false);
    }
  }, [isLocationLoading, recomputeNearest]);

  const onSelectSearchStation = useCallback(
    (station: StationRecord) => {
      clearSearchBlurTimer();
      setSearchQuery(station.durakAd);
      Keyboard.dismiss();
      setIsSearchFocused(false);
      if (!hasRealMapCoordinates(station)) {
        Alert.alert('', 'Bu durak için koordinat bulunamadı');
        return;
      }
      focusOnStation(station);
    },
    [clearSearchBlurTimer, focusOnStation]
  );

  const onSelectNearestRow = useCallback(
    (station: StationRecord) => {
      clearSearchBlurTimer();
      Keyboard.dismiss();
      setIsSearchFocused(false);
      focusOnStation(station);
    },
    [clearSearchBlurTimer, focusOnStation]
  );

  const showSearchDropdown = isSearchFocused && debouncedSearch.trim().length > 0;

  useEffect(() => {
    return () => {
      if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
    };
  }, []);

  const fabBottom = Math.max(insets.bottom, 10) + 8;
  const cardBottom = Math.max(insets.bottom, 8) + 8;
  const fabRight = 12 + insets.right;
  const searchSidePad = 12 + insets.left;
  const searchRightPad = 12 + insets.right;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <View style={styles.top}>
          <Text style={styles.screenTitle}>Harita</Text>
          <DateTimeSelector
            sortedDates={sortedDates}
            tarih={tarih}
            saat={saat}
            onChangeDate={setTarih}
            onChangeHour={setSaat}
            predictionOnlyDates={markPredictionOnlyDates}
          />
          <View style={styles.legendPad}>
            <DensityLegend />
          </View>
        </View>
        <View style={styles.mapWrap} pointerEvents="box-none">
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={KAYSERI_REGION}
            mapType="standard"
            showsUserLocation={showUserOnMap}
            showsMyLocationButton={false}
            loadingEnabled
            onPress={onPressMap}
          >
            {userMapPosition ? (
              <Circle
                center={userMapPosition}
                radius={USER_ACCURACY_CIRCLE_M}
                fillColor="rgba(59, 130, 246, 0.14)"
                strokeColor="rgba(96, 165, 250, 0.55)"
                strokeWidth={1.5}
              />
            ) : null}
            {stations.map((station) => {
              const yolcu = countById.get(station.durakId) ?? 0;
              const density = getDensityLevel(yolcu);
              const color = density.color;
              const densityLabel = density.label;
              return (
                <StationMarker
                  key={station.durakId}
                  station={station}
                  pinColor={color}
                  yolcuSayisi={yolcu}
                  densityLabel={densityLabel}
                  saat={saat}
                  yolcuTitle={yolcuCalloutTitle}
                  densityTitle={densityCalloutTitle}
                  confidenceLabel={mapConfidence}
                  recommendationLine={calloutRecById.get(station.durakId) ?? null}
                  isMapFocused={focusedStationId === station.durakId}
                  onMarkerRef={(m) => {
                    markerRefs.current[station.durakId] = m;
                  }}
                  onGoDetail={() =>
                    router.push(
                      `/station/${encodeURIComponent(station.durakId)}?tarih=${encodeURIComponent(
                        tarih
                      )}&saat=${encodeURIComponent(String(saat))}`
                    )
                  }
                />
              );
            })}
          </MapView>

          <View
            style={[styles.mapSearchOverlay, { left: searchSidePad, right: searchRightPad }]}
            pointerEvents="box-none"
          >
            <View style={styles.searchBox} pointerEvents="box-none">
              <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => {
                  clearSearchBlurTimer();
                  setIsSearchFocused(true);
                }}
                onBlur={() => {
                  searchBlurTimer.current = setTimeout(() => {
                    setIsSearchFocused(false);
                    searchBlurTimer.current = null;
                  }, 280);
                }}
                placeholder="Durak ara…"
                placeholderTextColor={theme.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={10}
                  style={styles.clearBtn}
                  accessibilityLabel="Aramayı temizle"
                >
                  <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                </Pressable>
              ) : null}
            </View>
            {showSearchDropdown ? (
              <View style={styles.dropdown} pointerEvents="box-none">
                {searchResults.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>Eşleşen durak yok</Text>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(s) => s.durakId}
                    style={styles.dropdownList}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    renderItem={({ item }) => (
                      <Pressable
                        onPressIn={clearSearchBlurTimer}
                        onPress={() => onSelectSearchStation(item)}
                        style={({ pressed }) => [
                          styles.dropdownRow,
                          pressed && styles.dropdownRowPressed,
                        ]}
                      >
                        <Text style={styles.dropdownName}>{item.durakAd}</Text>
                        {!hasRealMapCoordinates(item) ? (
                          <Text style={styles.dropdownHint}>Konum yok</Text>
                        ) : null}
                      </Pressable>
                    )}
                  />
                )}
              </View>
            ) : null}
          </View>

          {nearestStations.length > 0 ? (
            <View
              style={[styles.nearestCard, { bottom: cardBottom, left: searchSidePad, right: 72 + insets.right }]}
            >
              <Text style={styles.nearestTitle}>En yakın duraklar</Text>
              {nearestStations.map((e, i) => {
                const isHighlighted = e.station.durakId === focusedStationId;
                return (
                  <Pressable
                    key={e.station.durakId}
                    onPress={() => onSelectNearestRow(e.station)}
                    style={({ pressed }) => [
                      styles.nearestRow,
                      isHighlighted && styles.nearestRowHighlighted,
                      pressed && styles.nearestRowPressed,
                    ]}
                  >
                    <Text
                      style={[styles.nearestIndex, isHighlighted && styles.nearestTextHighlight]}
                    >
                      {i + 1}.
                    </Text>
                    <Text
                      style={[styles.nearestName, isHighlighted && styles.nearestTextHighlight]}
                      numberOfLines={1}
                    >
                      {e.station.durakAd}
                    </Text>
                    <Text style={[styles.nearestDist, isHighlighted && styles.nearestDistHighlight]}>
                      {formatDistanceM(e.distanceM)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable
            onPress={onPressMyLocation}
            disabled={isLocationLoading}
            style={({ pressed }) => [
              styles.fab,
              { bottom: fabBottom, right: fabRight },
              (pressed && !isLocationLoading) && styles.fabPressed,
              isLocationLoading && styles.fabDisabled,
            ]}
            accessibilityLabel="Konumuma git"
          >
            {isLocationLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="navigate" size={22} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  kav: { flex: 1 },
  top: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: theme.background,
  },
  screenTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  legendPad: { marginTop: 4 },
  mapWrap: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  mapSearchOverlay: {
    position: 'absolute',
    top: 10,
    zIndex: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 42, 82, 0.94)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingLeft: 10,
    paddingRight: 4,
    minHeight: 44,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  clearBtn: { padding: 4 },
  dropdown: {
    marginTop: 6,
    maxHeight: 200,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...theme.shadow,
  },
  dropdownList: { maxHeight: 200 },
  dropdownEmpty: {
    padding: 14,
    color: theme.textMuted,
    fontSize: 14,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: 8,
  },
  dropdownRowPressed: { backgroundColor: theme.accentSoft },
  dropdownName: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownHint: { color: theme.textMuted, fontSize: 12 },
  nearestCard: {
    position: 'absolute',
    zIndex: 10,
    maxWidth: 320,
    backgroundColor: 'rgba(18, 42, 82, 0.94)',
    borderRadius: theme.cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...theme.shadow,
  },
  nearestTitle: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  nearestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginHorizontal: -4,
    borderRadius: 8,
    gap: 8,
  },
  nearestRowHighlighted: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  nearestRowPressed: { opacity: 0.88 },
  nearestIndex: { color: theme.textMuted, width: 22, fontSize: 14, fontWeight: '700' },
  nearestName: { flex: 1, color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  nearestDist: { color: theme.accent, fontSize: 14, fontWeight: '700' },
  nearestTextHighlight: { color: theme.textPrimary },
  nearestDistHighlight: { color: '#93C5FD' },
  fab: {
    position: 'absolute',
    zIndex: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow,
  },
  fabDisabled: { opacity: 0.75 },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
