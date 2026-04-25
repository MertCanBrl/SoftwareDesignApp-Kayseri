import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

type Props = {
  title: string;
  value: string;
  subtitle?: string;
};

export function StatCard({ title, value, subtitle }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
  },
  title: {
    color: theme.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '600',
  },
  value: {
    color: theme.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
