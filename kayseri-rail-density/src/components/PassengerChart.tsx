import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import type { HourlyPoint } from '../types';
import { theme } from '../constants/theme';

type Props = {
  points: HourlyPoint[];
  highlightHour: number | null;
};

export function PassengerChart({ points, highlightHour }: Props) {
  const width = Math.min(Dimensions.get('window').width - 32, 360);

  const { labels, data } = useMemo(() => {
    const byHour = new Map<number, number>();
    for (const p of points) {
      byHour.set(p.saat, p.yolcuSayisi);
    }
    const labelsArr: string[] = [];
    const dataArr: number[] = [];
    for (let h = 0; h < 24; h += 1) {
      labelsArr.push(`${h}`);
      dataArr.push(byHour.get(h) ?? 0);
    }
    return { labels: labelsArr, data: dataArr };
  }, [points]);

  const highlightNote =
    highlightHour != null ? `Vurgu: saat ${String(highlightHour).padStart(2, '0')}:00` : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Saatlik yolcu dağılımı</Text>
      {highlightNote ? <Text style={styles.note}>{highlightNote}</Text> : null}
      <BarChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        yAxisLabel=""
        yAxisSuffix=""
        width={width}
        height={220}
        fromZero
        chartConfig={{
          backgroundGradientFrom: theme.surface,
          backgroundGradientTo: theme.surfaceElevated,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          labelColor: () => theme.textMuted,
          propsForBackgroundLines: {
            stroke: theme.border,
            strokeDasharray: '0',
          },
          barPercentage: 0.55,
        }}
        style={styles.chart}
        verticalLabelRotation={0}
        withInnerLines
        showValuesOnTopOfBars={false}
        flatColor
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  title: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginBottom: 4,
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginBottom: 8,
    color: theme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  chart: {
    borderRadius: theme.cardRadius,
    marginVertical: 4,
  },
});
