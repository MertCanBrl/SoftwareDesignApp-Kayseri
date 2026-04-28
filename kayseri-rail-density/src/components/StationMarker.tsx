import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Callout, MapMarker, Marker } from 'react-native-maps';
import type { StationRecord } from '../types';
import { theme } from '../constants/theme';

type Props = {
  station: StationRecord;
  pinColor: string;
  yolcuSayisi: number;
  densityLabel: string;
  saat: number;
  onGoDetail: () => void;
  /** Harita odak / arama sonrası callout için */
  onMarkerRef?: (instance: MapMarker | null) => void;
  /** Arama veya “en yakın” ile vurgulama */
  isMapFocused?: boolean;
  /** Callout: "Tahmini Yolcu" / "Gerçek Yolcu" / "Yolcu" */
  yolcuTitle?: string;
  /** Callout: "Tahmini Yoğunluk" / "Gerçek Yoğunluk" / "Yoğunluk" */
  densityTitle?: string;
  /** Tahmin: "Yüksek" / "Orta" / "Düşük" — sadece dataType prediction iken */
  confidenceLabel?: string;
  /** Tek satır kısa öneri (örn. öneri satırı) */
  recommendationLine?: string | null;
};

const PULSE_MS = 95;

export function StationMarker({
  station,
  pinColor,
  yolcuSayisi,
  densityLabel,
  saat,
  onGoDetail,
  onMarkerRef,
  isMapFocused,
  yolcuTitle = 'Yolcu',
  densityTitle = 'Yoğunluk',
  confidenceLabel,
  recommendationLine,
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isMapFocused) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1.14,
        duration: PULSE_MS,
        useNativeDriver: true,
      }),
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 220,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [isMapFocused, pulse]);

  return (
    <Marker
      ref={(r) => onMarkerRef?.(r)}
      coordinate={{ latitude: station.latitude, longitude: station.longitude }}
      tracksViewChanges={!!isMapFocused}
      anchor={{ x: 0.5, y: 1 }}
    >
      <Animated.View
        style={{
          transform: [{ scale: pulse }],
        }}
      >
        <View
          style={[
            styles.dotOuter,
            { borderColor: pinColor },
            isMapFocused ? styles.dotOuterFocused : null,
          ]}
        >
          <View style={[styles.dotInner, { backgroundColor: pinColor }]} />
        </View>
      </Animated.View>
      <Callout tooltip={false}>
        <View style={styles.callout}>
          <Text style={styles.stationName}>{station.durakAd}</Text>
          {station.approximate ? <Text style={styles.warn}>Yaklaşık konum</Text> : null}
          <Text style={styles.row}>
            <Text style={styles.muted}>Saat: </Text>
            <Text style={styles.val}>{String(saat).padStart(2, '0')}:00</Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.muted}>{yolcuTitle}: </Text>
            <Text style={styles.val}>
              {yolcuSayisi.toLocaleString('tr-TR')} yolcu
            </Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.muted}>{densityTitle}: </Text>
            <Text style={styles.val}>{densityLabel}</Text>
          </Text>
          {confidenceLabel ? (
            <Text style={styles.row}>
              <Text style={styles.muted}>Güven: </Text>
              <Text style={styles.val}>{confidenceLabel}</Text>
            </Text>
          ) : null}
          {recommendationLine ? (
            <Text style={styles.recLine} numberOfLines={2}>
              {recommendationLine}
            </Text>
          ) : null}
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
  dotOuterFocused: {
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 8,
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
  recLine: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
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
