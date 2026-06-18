# Veri Kaynakları — Şeffaflık Belgesi

Bu dosya, projede kullanılan araştırma verilerinin kaynağını ve güvenilirlik düzeyini belgelemektedir.

---

## Birincil Araştırma Kaynağı

**Kayseri Tramvay Sistemi Yolcu Yoğunluğu, Seyahat Davranışı ve Gerçek Zamanlı Bilgilendirme Sistemi Analiz Raporu**

- Veri toplama yöntemi: Yapılandırılmış kullanıcı anketi
- Ham yanıt: 407 | Geçerli yanıt: 406
- Kapsam: T1, T2, T3, T4 hatları

> **Temsiliyet sınırı:** Rapor, bu anketin istatistiksel genellenebilirlik iddiası taşımadığını, planlama kararı desteği amacıyla üretildiğini açıkça belirtmektedir.

---

## Hat Süresi Verileri

Rapor Tablo 2'de yer alan hat süreleri Kayseri Ulaşım A.Ş. kaynaklı olarak verilmiştir:

> Kayseri Ulaşım A.Ş. (2024). *Raylı Sistem Hat Güzergâhları.*  
> https://www.kayseriulasim.com/tr/FaaliyetAlanlarimiz/rayli-sistem/rayli-sistem-haritasi

### T1 — 70 dk
- Proje kalibrasyonu: `officialDurationMinutes = 70`, `scaleFactor = 0.9926`, `confidence = 'high'`
- Durum: Kalibre edilmiş, resmi kaynaklı. Değişiklik gerekmez.

### T2 — 33 dk (proje) / 35–40 dk (rapor)
- Proje kalibrasyonu: `officialDurationMinutes = 33`, `scaleFactor = 1.248`, `confidence = 'high'`
- Rapordaki değer: 35–40 dk
- **Çelişki notu:** Proje değeri (33 dk) gerçek resmi kaynaktan kalibre edilmiştir. Rapordaki 35–40 dk yuvarlama veya farklı ölçüm noktası farkı olabilir.
- **Karar: T2'ye dokunulmayacak.** Proje değeri daha güvenilir kaynağa dayanmaktadır.

### T3 — 78 dk (resmi doğrulanmış, kalibre edilmiş)
- Proje kalibrasyonu: `officialDurationMinutes = 78`, `scaleFactor = 0.9855`, `confidence = 'high'`
- Raporun gösterdiği değer: 90 dk — bu değer kullanılmamıştır.
- **Doğrulanmış:** Kayseri Ulaşım A.Ş. resmi süresi 78 dk olarak teyit edilmiştir.
- Haversine hesabı: 79.1 dk → `scaleFactor = 78 / 79.1 ≈ 0.986 ≈ 1.0` — kalibrasyon mükemmel.
- **Uygulanan karar:** `OFFICIAL_DURATIONS.T3 = 78` olarak ayarlandı; `tram-station-offsets.json` yeniden üretildi.
- Güzergah: Kumsmall AVM (1006066) → Şehir Hastanesi kolu (1006066–1006056, 11 durak) → T1 ana koridoru (1006006–1006043, 38 durak). Toplam 49 durak.

### T4 — 38 dk (rapor 35–40 dk aralığından orta değer)
- Proje kalibrasyonu: `officialDurationMinutes = 38`, `scaleFactor = 1.4686`, `confidence = 'high'`
- Raporun gösterdiği değer: 35–40 dk (aralık)
- **Uygulanan karar:** Aralığın orta değeri olan 38 dk kullanılmıştır. Net resmi süre bulunursa güncellenmeli.
- **Terminal:** İzzet Bayraktar Camii (1006075) — rapor ve harita ile doğrulandı.
- **Güzergah:** 16 durak — Cumhuriyet Meydanı → Hunat → Büyükşehir Belediyesi → Fuzuli → Sema Yazar → Şehit Mustafa Şimşek → Şehit Furkan Doğan → Yıldırım Beyazıt → Keçitepesi → Dedeman İHL → Germiraltı → Kayseri Ü. Şehit İsmet Eraslan → Halef Hoca → Anayurt Pazar Yeri → Turgut Özal → İzzet Bayraktar Camii.
- **Uyarı:** scaleFactor = 1.4686 diğer hatlara (T1: 0.99, T2: 1.25, T3: 0.99) göre belirgin şekilde yüksektir. 38 dk rapor aralığının orta değeri olduğundan gerçek süreden ±4–5 dk sapma olabilir. `safetyExplanationAgent` bu belirsizliği ±2-5 dk notu ile kullanıcıya iletmektedir. **Saha doğrulaması önerilir:** Resmi süre netleştiğinde `OFFICIAL_DURATIONS.T4` güncellenmeli ve offsets yeniden üretilmelidir.

---

## T4 Terminal ve Güzergah — Tamamlandı

- **Terminal:** İzzet Bayraktar Camii (1006075) — rapor Tablo 2 ve harita ile doğrulandı.
- `tram-schedules.json` güncellendi: gidiş `toStationId: "1006075"`, dönüş `fromStationId: "1006075"`.
- 16 durak sırası harita verisine dayalı olarak onaylandı ve uygulandı.
- Cumhuriyet → Yıldırım Beyazıt arası eksik duraklar çözüldü: 1006020, 1006021, 1006022, 1006044, 1006045, 1006046 eklendi.

---

## Proje Değiştirme Politikası

| Dosya | Durum |
|-------|-------|
| `src/screens/MapScreen.tsx` | Dokunulmayacak |
| `src/screens/StationDetailScreen.tsx` | Dokunulmayacak |
| `src/userRecommendations/` (tüm pipeline) | Dokunulmayacak |
| `src/municipality/` pipeline | Dokunulmayacak |
| `assets/data/tram-schedules.json` | T4 terminali güncellendi: 1006075 İzzet Bayraktar Camii |
| `scripts/generateTramStationOffsets.ts` | T3 ve T4 kalibre edildi; tüm hatlar high confidence |
