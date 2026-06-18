# Kayseri Tramvay Sistemi Kullanıcı Anketi — Bulgular Özeti

**Rapor adı:** Kayseri Tramvay Sistemi Yolcu Yoğunluğu, Seyahat Davranışı ve Gerçek Zamanlı Bilgilendirme Sistemi Analiz Raporu  
**Veri kaynağı:** Yapılandırılmış kullanıcı anketi (Kayseri tramvay kullanıcıları)  
**Kapsam:** T1, T2, T3, T4 hatları

> **Temsiliyet uyarısı:** Bu anket temsili nüfus örneklemi değildir; planlama kararı desteği amacıyla kullanılmalıdır. İstatistiksel genellenebilirlik iddiası taşımaz.

---

## Örneklem

| Gösterge | Değer |
|----------|-------|
| Ham yanıt | 407 |
| Geçerli yanıt | 406 |
| Günlük kullananlar | %53,9 |
| Düzenli kullanıcılar (günlük + haftada birkaç kez) | %92,1 |
| Kadın katılımcı | %52,7 |
| Tam zamanlı çalışan | %42,1 |
| Öğrenci | %28,8 |

**Yaş dağılımı:**

| Yaş aralığı | % |
|-------------|---|
| 18–24 | 29,6 |
| 25–34 | 16,0 |
| 35–44 | 19,2 |
| 45–54 | 15,5 |
| 55–64 | 9,9 |
| 65+ | 9,9 |

---

## Yoğunluk Algısı

- **Yüksek yoğunluk algısı: %87,5** (her zaman + genellikle kalabalık)
  - Her zaman kalabalık: %21,4
  - Genellikle kalabalık: %66,1
  - Bazen kalabalık: %11,0

**Yoğunluğun yolculuğa etkileri:**

| Etki | % |
|------|---|
| Ayakta yolculuk konforsuzluğu | 43,9 |
| Zihinsel yorgunluk | 33,0 |
| Geç kalma riski | 21,1 |
| Güvenlik endişesi | 2,0 |

---

## Zirve Saatleri

| Dilim | Seçilme oranı |
|-------|--------------|
| **Sabah zirvesi: 08:00–10:00** | %64,5 |
| Erken sabah: 06:00–08:00 | %41,1 |
| **Akşam zirvesi: 18:00–20:00** | %52,7 |

> Çoklu seçim sorusudur; yüzdeler toplanmaz. Sistem çift zirve yapısı göstermektedir.

---

## Dijital Kabul ve Uygulama İsteği

- **Gerçek zamanlı yoğunluk uygulaması kullanım isteği: %82,0** (kesinlikle evet + büyük ihtimalle evet)
- Kararsız: %13,3
- Olumsuz: %2,5

**Hat bazında kullanım isteği en yüksek yaş grubu:** 55–64 yaş (%90,0)

**İstenen özellikler:**

| Özellik | % |
|---------|---|
| Alternatif güzergah önerisi | 21,7 |
| Bildirim sistemi | 17,7 |
| Günlük/haftalık yoğunluk tahmini | 17,2 |
| Canlı yoğunluk haritası | 15,0 |

---

## Davranış Değişimi Potansiyeli

- **Uygulamayla davranış değiştirme isteği: %86,0**
  - Güzergah değiştirme: %56,0
  - Saat kaydırma: %30,0
  - Değiştirmem: %8,1
- Alternatif saate esneklik (evet + kararsız): **%75,6**

---

## Temel Kullanıcı Çekinceleri

| Çekince | % | Öncelik |
|---------|---|---------|
| Veri doğruluğu ve güvenilirlik | 37,4 | 1 |
| Kullanım zorluğu / zaman maliyeti | 25,9 | 2 |
| Zorunlu kontrol alışkanlığı riski | 15,3 | 3 |
| Teknoloji uyum güçlüğü | 10,1 | 4 |
| Gizlilik endişesi | 6,9 | 5 |

> **Not:** En yüksek çekince "veri doğruluğu"dur. Kullanıcı güveni, UX kalitesinden önce gelir.

---

## Hat Profilleri

> Süre verileri rapor Tablo 2'den alınmıştır; birincil kaynak Kayseri Ulaşım A.Ş. (2024) olarak gösterilmektedir. Ayrıntılar için [SOURCES.md](SOURCES.md) dosyasına bakın.

| Hat | Güzergah | Rapor süresi | Proje kalibrasyonu | Güven |
|-----|----------|-------------|-------------------|-------|
| T1 | Organize Sanayi – İldem 5 | 70 dk | 70 dk, scaleFactor ≈ 1.0 | Yüksek |
| T2 | Talas Cemil Baba – Cumhuriyet Meydanı | 35–40 dk* | 33 dk, scaleFactor 1.25 | Yüksek |
| T3 | İldem 5 – Kumsmall AVM (Şehir Hastanesi güzergâhı) | 90 dk† | 78 dk, scaleFactor ≈ 1.0 | Yüksek |
| T4 | Cumhuriyet Meydanı – İzzet Bayraktar Camii | 35–40 dk‡ | 38 dk, 16 durak, scaleFactor 1.47 | Yüksek |

*T2 için proje 33 dk ile kalibre edilmiştir; rapordaki 35–40 dk yuvarlama veya farklı ölçüm noktası farkı olabilir. T2'ye dokunulmayacaktır.

†T3 için raporun gösterdiği 90 dk değeri yerine Kayseri Ulaşım A.Ş. resmi süresi olan 78 dk kullanılmıştır. Haversine hesabı 79.1 dk vermektedir; scaleFactor = 0.9855 ≈ 1.0. Kalibrasyon mükemmeldir.

‡T4 için rapor 35–40 dk aralığı vermektedir; orta değer olan 38 dk kullanılmıştır. scaleFactor = 1.4686 diğer hatlara göre yüksektir; T4 tahminlerinde ±4–5 dk sapma olabileceği kabul edilmiştir. Saha doğrulaması önerilir. Terminal: İzzet Bayraktar Camii (stationId: 1006075).

**Hat bazında anket seçimleri:**

| Hat | Seçim sayısı | Yüksek yoğunluk algısı |
|-----|-------------|----------------------|
| T1 | 464 | %86,3 |
| T2 | 439 | %86,2 |
| T3 | 334 | %84,6 |
| T4 | 265 | %84,4 |

---

## Planlama İçin Temel Çıkarımlar

- Yoğunluk kronik bir sorundur, istisna değildir.
- Dijital çözüme kullanıcı hazırlığı yüksektir (%82,0).
- **Kritik başarı faktörü:** Veri doğruluğu ve güven. Kullanıcıların %37,4'ü bunu birinci çekince olarak belirtmiştir.
- Talep kaydırma potansiyeli mevcuttur (%75,6 esneklik).
- Kullanıcıların birinci beklentisi daha sık sefer (%59,9) — dijital çözümden önce arz artışı beklentisi söz konusudur.
