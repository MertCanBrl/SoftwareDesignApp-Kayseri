import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DENSITY_LEVELS, TRAM_CAPACITY, formatDensityRange } from '../constants/densityLevels';
import { theme } from '../constants/theme';

export function DensityLegend() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Yoğunluk ölçeği (tramvay kapasitesi: {TRAM_CAPACITY} kişi)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {DENSITY_LEVELS.map((level) => (
          <View key={level.key} style={styles.chip}>
            <View style={[styles.swatch, { backgroundColor: level.color }]} />
            <View style={styles.chipText}>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {level.label}
              </Text>
              <Text style={styles.chipRange}>{formatDensityRange(level)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 4,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 140,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipText: {
    flexShrink: 1,
  },
  chipLabel: {
    color: theme.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },
  chipRange: {
    color: theme.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
});
