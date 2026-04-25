import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../src/constants/theme';

export default function AboutRoute() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Proje hakkında</Text>
        <Text style={styles.p}>
          Bu uygulama, Kayseri Raylı Sistem (tramvay) durakları için saatlik yolcu sayılarını harita ve
          grafikler üzerinden incelemenize yardımcı olmak amacıyla geliştirilmiştir. Veriler Excel
          dosyasından yerel JSON’a dönüştürülür; internet bağlantısı harita döşemeleri ve isteğe bağlı
          dış kaynaklar içindir.
        </Text>
        <Text style={styles.h2}>Yöntem</Text>
        <Text style={styles.p}>
          Seçilen tarih ve saat için tüm durakların yolcu sayıları birlikte ele alınır; yoğunluk
          seviyeleri bu dilime özgü dağılım üzerinden dinamik olarak (yüzdelik dilimler) hesaplanır.
          Böylece sabit eşik değerleri yerine, seçilen zamana göre göreli bir yoğunluk ölçeği elde
          edilir.
        </Text>
        <Text style={styles.h2}>Konum verisi</Text>
        <Text style={styles.p}>
          Durak koordinatları OpenStreetMap Nominatim araması ile toplanır. Bulunamayan duraklar için
          uygulama, haritada görünürlük sağlamak amacıyla Kayseri merkezine yakın deterministik bir
          yaklaşık konum üretir; bu duraklar ekranda açıkça işaretlenir.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  h1: { color: theme.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  h2: { color: theme.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 8 },
  p: { color: theme.textSecondary, fontSize: 14, lineHeight: 22 },
});
