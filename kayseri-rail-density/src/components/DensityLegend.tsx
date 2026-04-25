import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getDensityColor } from '../utils/density';
import { theme } from '../constants/theme';

const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;
const LABELS = ['Düşük', 'Orta', 'Yüksek', 'Çok yüksek'];

export function DensityLegend() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Yoğunluk ölçeği (seçilen saate göre göreli)</Text>
      <View style={styles.bar}>
        {TICKS.map((t, i) => (
          <View
            key={String(t)}
            style={[
              styles.segment,
              { backgroundColor: getDensityColor(t) },
              i === 0 && styles.segFirst,
              i === TICKS.length - 1 && styles.segLast,
            ]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {LABELS.map((l) => (
          <Text key={l} style={styles.label}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: theme.cardRadius,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  caption: {
    color: theme.textSecondary,
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '500',
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
  },
  segFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: 10,
  },
});
