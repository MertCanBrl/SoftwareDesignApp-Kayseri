import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../constants/theme';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Akademik görselleştirme</Text>
          <Text style={styles.title}>Kayseri Raylı Sistem Yolcu Yoğunluğu Analizi</Text>
          <Text style={styles.subtitle}>
            Geçmiş saatlik yolcu verilerine göre durak bazlı yoğunluk analizi
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/map')}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>Haritayı Aç</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/statistics')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryBtnText}>İstatistikleri Gör</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/about')}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ghostBtnText}>Proje Hakkında</Text>
          </Pressable>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Veri kaynağı</Text>
          <Text style={styles.footerBody}>
            Uygulama canlı veri kullanmaz; Excel’den üretilen yerel JSON dosyası ile çalışır. Harita
            durakları OpenStreetMap Nominatim ile eşleştirilmiştir (bulunamayanlar için yaklaşık konum
            kullanılır).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 20 },
  headerCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
  },
  kicker: {
    color: theme.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: theme.cardRadius,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderRadius: theme.cardRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryBtnText: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.9 },
  footerCard: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  footerTitle: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  footerBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
});
