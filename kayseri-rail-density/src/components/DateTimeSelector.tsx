import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { theme } from '../constants/theme';
import { formatDisplayDate } from '../utils/date';

LocaleConfig.locales.tr = {
  monthNames: [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ],
  monthNamesShort: [
    'Oca',
    'Şub',
    'Mar',
    'Nis',
    'May',
    'Haz',
    'Tem',
    'Ağu',
    'Eyl',
    'Eki',
    'Kas',
    'Ara',
  ],
  dayNames: [
    'Pazar',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
  ],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  today: 'Bugün',
};
LocaleConfig.defaultLocale = 'tr';

type Props = {
  sortedDates: string[];
  tarih: string;
  saat: number;
  onChangeDate: (d: string) => void;
  onChangeHour: (h: number) => void;
  /** Sadece tahmin günleri (mavi nokta); geçmiş gün listesiyle kesişmemeli */
  predictionOnlyDates?: readonly string[];
};

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function yearMonthFromDateString(s: string): { year: number; month: number } {
  const [y, m] = s.split('-').map(Number);
  return { year: y, month: m };
}

function buildMarkedDates(
  year: number,
  month1to12: number,
  selected: string,
  available: Set<string>,
  predictionOnly: Set<string>
) {
  const out: Record<string, Record<string, unknown>> = {};
  const dim = daysInMonth(year, month1to12);
  for (let d = 1; d <= dim; d += 1) {
    const dayStr = d < 10 ? `0${d}` : String(d);
    const monthStr = month1to12 < 10 ? `0${month1to12}` : String(month1to12);
    const dateString = `${year}-${monthStr}-${dayStr}`;
    if (!available.has(dateString)) {
      out[dateString] = {
        disabled: true,
        disableTouchEvent: true,
        textColor: theme.textMuted,
      };
    } else if (predictionOnly.has(dateString)) {
      out[dateString] = {
        marked: true,
        dotColor: '#3b82f6',
      };
    }
  }
  if (available.has(selected)) {
    out[selected] = {
      ...out[selected],
      selected: true,
      selectedColor: '#111827',
    };
  }
  return out;
}

export function DateTimeSelector({
  sortedDates,
  tarih,
  saat,
  onChangeDate,
  onChangeHour,
  predictionOnlyDates = [],
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => yearMonthFromDateString(tarih));

  const availableDatesSet = useMemo(() => new Set(sortedDates), [sortedDates]);
  const predictionOnlySet = useMemo(
    () => new Set([...predictionOnlyDates]),
    [predictionOnlyDates]
  );
  const minDate = sortedDates[0];
  const maxDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : undefined;

  const idx = sortedDates.indexOf(tarih);
  const prev = idx > 0 ? sortedDates[idx - 1] : null;
  const next = idx >= 0 && idx < sortedDates.length - 1 ? sortedDates[idx + 1] : null;

  useEffect(() => {
    if (!calendarOpen) return;
    const { year, month } = yearMonthFromDateString(tarih);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      setVisibleMonth({ year, month });
    }
  }, [calendarOpen, tarih]);

  const markedDates = useMemo(
    () =>
      buildMarkedDates(visibleMonth.year, visibleMonth.month, tarih, availableDatesSet, predictionOnlySet),
    [visibleMonth, tarih, availableDatesSet, predictionOnlySet]
  );

  const onDayPress = (day: DateData) => {
    if (!availableDatesSet.has(day.dateString)) return;
    onChangeDate(day.dateString);
    setCalendarOpen(false);
  };

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Takvimden tarih seç"
          onPress={() => {
            if (sortedDates.length) setCalendarOpen(true);
          }}
          style={({ pressed }) => [styles.dateBox, pressed && styles.pressed, !sortedDates.length && styles.disabled]}
          disabled={!sortedDates.length}
        >
          <Text style={styles.dateLabel}>Tarih</Text>
          <Text style={styles.dateValue}>{formatDisplayDate(tarih)}</Text>
        </Pressable>
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

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
            onPress={() => setCalendarOpen(false)}
            accessibilityLabel="Kapat"
          />
          <View style={styles.calendarCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tarih seçin</Text>
              <Pressable
                onPress={() => setCalendarOpen(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Text style={styles.closeBtnText}>Kapat</Text>
              </Pressable>
            </View>
            {minDate && maxDate && (
              <Calendar
                key={tarih}
                current={tarih}
                minDate={minDate}
                maxDate={maxDate}
                onDayPress={onDayPress}
                onMonthChange={(m) => setVisibleMonth({ year: m.year, month: m.month })}
                markedDates={markedDates}
                firstDay={1}
                enableSwipeMonths
                hideExtraDays
                theme={{
                  calendarBackground: theme.surfaceElevated,
                  backgroundColor: theme.surfaceElevated,
                  textSectionTitleColor: theme.textMuted,
                  textSectionTitleDisabledColor: theme.textMuted,
                  dayTextColor: theme.textPrimary,
                  textDisabledColor: theme.textMuted,
                  monthTextColor: theme.textPrimary,
                  selectedDayBackgroundColor: '#111827',
                  selectedDayTextColor: theme.textPrimary,
                  todayTextColor: theme.accent,
                  arrowColor: theme.textPrimary,
                  textDayFontWeight: '600',
                  textMonthFontWeight: '700',
                }}
                style={styles.calendarInner}
              />
            )}
          </View>
        </View>
      </Modal>
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
  dateBox: { alignItems: 'center', flex: 1, paddingVertical: 4 },
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
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  closeBtnText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  calendarInner: {
    borderRadius: 0,
  },
});
