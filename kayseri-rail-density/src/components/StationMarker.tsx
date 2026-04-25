import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';
import type { StationRecord } from '../types';
import { theme } from '../constants/theme';

type Props = {
  station: StationRecord;
  pinColor: string;
  yolcuSayisi: number;
  densityLabel: string;
  tarih: string;
  saat: number;
  onGoDetail: () => void;
};

export function StationMarker({
  station,
  pinColor,
  yolcuSayisi,
  densityLabel,
  tarih,
  saat,
  onGoDetail,
}: Props) {
  return (
    <Marker
      coordinate={{ latitude: station.latitude, longitude: station.longitude }}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={[styles.dotOuter, { borderColor: pinColor }]}>
        <View style={[styles.dotInner, { backgroundColor: pinColor }]} />
      </View>
      <Callout tooltip={false}>
        <View style={styles.callout}>
          <Text style={styles.stationName}>{station.durakAd}</Text>
          {station.approximate ? <Text style={styles.warn}>Yaklaşık konum</Text> : null}
          <Text style={styles.row}>
            <Text style={styles.muted}>Tarih: </Text>
            <Text style={styles.val}>{tarih}</Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.muted}>Saat: </Text>
            <Text style={styles.val}>{String(saat).padStart(2, '0')}:00</Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.muted}>Yolcu: </Text>
            <Text style={styles.val}>{yolcuSayisi}</Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.muted}>Yoğunluk: </Text>
            <Text style={styles.val}>{densityLabel}</Text>
          </Text>
          <TouchableOpacity onPress={onGoDetail} style={styles.btn} activeOpacity={0.85}>
            <Text style={styles.btnText}>Detaya Git</Text>
          </TouchableOpacity>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,27,58,0.85)',
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  callout: {
    minWidth: 220,
    padding: 12,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stationName: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  warn: {
    color: theme.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  row: { marginBottom: 4 },
  muted: { color: theme.textMuted, fontSize: 12 },
  val: { color: theme.textPrimary, fontSize: 12, fontWeight: '600' },
  btn: {
    marginTop: 10,
    backgroundColor: theme.accent,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
