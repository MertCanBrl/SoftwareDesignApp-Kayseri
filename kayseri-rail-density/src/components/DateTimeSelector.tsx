import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { formatDisplayDate } from '../utils/date';

type Props = {
  sortedDates: string[];
  tarih: string;
  saat: number;
  onChangeDate: (d: string) => void;
  onChangeHour: (h: number) => void;
};

export function DateTimeSelector({ sortedDates, tarih, saat, onChangeDate, onChangeHour }: Props) {
  const idx = sortedDates.indexOf(tarih);
  const prev = idx > 0 ? sortedDates[idx - 1] : null;
  const next = idx >= 0 && idx < sortedDates.length - 1 ? sortedDates[idx + 1] : null;

  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, !prev && styles.disabled]}
          onPress={() => prev && onChangeDate(prev)}
          disabled={!prev}
        >
          <Text style={styles.navText}>◀</Text>
        </Pressable>
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Tarih</Text>
          <Text style={styles.dateValue}>{formatDisplayDate(tarih)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, !next && styles.disabled]}
          onPress={() => next && onChangeDate(next)}
          disabled={!next}
        >
          <Text style={styles.navText}>▶</Text>
        </Pressable>
      </View>
      <Text style={styles.hourTitle}>Saat</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourScroll}>
        {hours.map((h) => {
          const active = h === saat;
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              onPress={() => onChangeHour(h)}
              style={({ pressed }) => [
                styles.hourChip,
                active && styles.hourChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.hourText, active && styles.hourTextActive]}>{String(h).padStart(2, '0')}:00</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  navText: { color: theme.textPrimary, fontSize: 16 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.85 },
  dateBox: { alignItems: 'center', flex: 1 },
  dateLabel: { color: theme.textMuted, fontSize: 11, marginBottom: 4 },
  dateValue: { color: theme.textPrimary, fontSize: 18, fontWeight: '700' },
  hourTitle: {
    marginTop: 12,
    marginBottom: 8,
    color: theme.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hourScroll: { gap: 8, paddingBottom: 4 },
  hourChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  hourChipActive: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accent,
  },
  hourText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  hourTextActive: { color: theme.textPrimary },
});
