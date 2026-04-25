import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { DensityLegend } from '../components/DensityLegend';
import { StationMarker } from '../components/StationMarker';
import { KAYSERI_REGION, theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import {
  calculatePercentiles,
  getDensityColor,
  getDensityLabel,
  getDensityLevel,
  percentileRank01,
} from '../utils/density';
import { getPassengerCountByStationDateHour } from '../utils/statistics';

export function MapScreen() {
  const { passengerRows, stations, sortedDates, tarih, saat, setTarih, setSaat } = useSelection();

  const { countsById, sortedCounts, qs } = useMemo(() => {
    const countsById = new Map<string, number>();
    for (const s of stations) {
      const c = getPassengerCountByStationDateHour(passengerRows, s.durakId, tarih, saat);
      countsById.set(s.durakId, c ?? 0);
    }
    const sortedCounts = [...countsById.values()].sort((a, b) => a - b);
    const qs = calculatePercentiles(sortedCounts);
    return { countsById, sortedCounts, qs };
  }, [passengerRows, stations, tarih, saat]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Text style={styles.screenTitle}>Harita</Text>
        <DateTimeSelector
          sortedDates={sortedDates}
          tarih={tarih}
          saat={saat}
          onChangeDate={setTarih}
          onChangeHour={setSaat}
        />
        <View style={styles.legendPad}>
          <DensityLegend />
        </View>
      </View>
      <MapView
        style={styles.map}
        initialRegion={KAYSERI_REGION}
        mapType="standard"
        showsUserLocation={false}
        loadingEnabled
      >
        {stations.map((station) => {
          const yolcu = countsById.get(station.durakId) ?? 0;
          const pr = qs ? percentileRank01(yolcu, sortedCounts) : 0;
          const color = getDensityColor(pr);
          const level = qs ? getDensityLevel(yolcu, qs) : 'low';
          const densityLabel = getDensityLabel(level);
          return (
            <StationMarker
              key={station.durakId}
              station={station}
              pinColor={color}
              yolcuSayisi={yolcu}
              densityLabel={densityLabel}
              tarih={tarih}
              saat={saat}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
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
  map: { flex: 1 },
});
