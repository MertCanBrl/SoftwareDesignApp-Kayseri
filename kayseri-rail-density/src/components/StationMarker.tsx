import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Marker, type MapMarker } from 'react-native-maps';
import type { StationRecord } from '../types';
import { theme } from '../constants/theme';

type Props = {
  station: StationRecord;
  pinColor: string;
  isMapFocused?: boolean;
  onMarkerRef?: (instance: MapMarker | null) => void;
  onPress?: () => void;
};

const PULSE_MS = 95;

export function StationMarker({
  station,
  pinColor,
  isMapFocused,
  onMarkerRef,
  onPress,
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isMapFocused) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(pulse, { toValue: 1.14, duration: PULSE_MS, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, friction: 5, tension: 220 }),
    ]);
    anim.start();
    return () => { anim.stop(); };
  }, [isMapFocused, pulse]);

  return (
    <Marker
      ref={(r) => onMarkerRef?.(r)}
      coordinate={{ latitude: station.latitude, longitude: station.longitude }}
      tracksViewChanges={!!isMapFocused}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
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
      </TouchableOpacity>
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
  dotInner: { width: 12, height: 12, borderRadius: 6 },
});
