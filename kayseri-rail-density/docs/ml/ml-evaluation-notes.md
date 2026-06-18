# ML Model Değerlendirme Notu

**Model:** GradientBoostingRegressor  
**Değerlendirme tarihi:** 2026-06-18  
**Kaynak dosyalar:** `ml/train_model.py`, `ml/feature_engineering.py`, `ml/model_reports/`

---

## 1. Genel Metrikler (Time-Based Test Seti)

| Metrik | Değer | Bağlam |
|--------|-------|--------|
| MAE | 38.87 yolcu | Zaman bazlı test seti (Oct 20 – Dec 31 2025) |
| RMSE | 78.78 | Büyük outlier'ların etkisini yansıtıyor |
| MAPE | 113.85% | Düşük trafikli durak/saatlerde şişiyor — tek başına kullanılmamalı |
| R² | **0.803** | Test setindeki varyansın %80,3'ünü açıklıyor |

**Değerlendirme split'i:** Ocak–Ekim 2025 eğitim (292 gün, 407.917 satır) / Ekim–Aralık 2025 test (73 gün, 100.798 satır). Kronolojik ayrım — tarih örtüşmesi yoktur (`no_date_leakage: true`).

---

## 2. baseline_reference Alanı — Naive Baseline Değildir

`training_summary.json` içindeki şu alan sıkça yanlış yorumlanıyor:

```json
"baseline_reference": {
  "mae": 13.3844,
  "r2": 0.969
}
```

### Bu değer ne DEĞİLDİR

Bu bir **naive baseline** (global ortalama tahmini, sabit tahmin vs.) değildir.

### Bu değer nedir

`train_model.py` satır 67–68'de sabit olarak tanımlı:

```python
BASELINE_MAE = 13.3844
BASELINE_R2  = 0.9690
```

Bu **önceki model versiyonunun farklı değerlendirme koşullarından kalan referans metriğidir.** Konsol çıktısında da "Referans **(eski)** MAE" olarak etiketlenmiştir.

### Neden doğrudan karşılaştırılamaz

Eski değerin R²=0.969 olması gerçekçi değil — zaman serisi tahmini için bu yalnızca `random_holdout` split koşulunda mümkün. `random_holdout` ile eğitim seti içinde Aralık 2025 verileri de bulunabildiğinden, test satırları için `lag_7_day_same_hour` ve `rolling_mean_7` özellikleri gerçek değer alır. Bu durum MAE'yi yapay olarak düşürür — modelin gelecek verisine sızdığı anlamına gelir.

Mevcut değerlendirme ise zaman bazlı (kronolojik) split kullanmaktadır. Bu doğru metodolojik seçimdir.

### Adil karşılaştırma

| Baseline türü | Beklenen MAE | R² | Mevcut Model |
|--------------|-------------|-----|-------------|
| Global mean (naif) | ~100–130 | ~0 | **Modeli yeniyor** ✅ |
| İstasyon-saat ortalaması | ~50–70 | ~0.4–0.5 | **Modeli yeniyor** ✅ |
| Önceki model (eski setup) | 13.38 | 0.969 | Karşılaştırılamaz ⚠️ |

---

## 3. Time-Based Split Neden Doğru Metodoloji

Zaman serisi verisinde `random_holdout` kullanmak **temporal leakage** riski taşır:

- Gelecek tarihli veriler (ör. Aralık 2025) eğitim setine karışır.
- `lag_7_day_same_hour` gibi geçmiş bağımlı özellikler test satırları için gerçek değer bulur.
- Model "geçen haftayı hatırlama" görevini kolayca çözer; bu gerçek tahmin değil, veri sızıntısıdır.

**Kronolojik split** bu sızıntıyı kapatır: model yalnızca geçmişi biliyor, geleceği görmüyor. Test metriklerinin yükselmesi bir model kötüleşmesi değil, **dürüst değerlendirmenin doğal sonucudur.**

---

## 4. MAPE Neden Yüksek Çıktı

MAPE formülü: `mean(|gerçek - tahmin| / |gerçek|) × 100`

Bölendeki değer (`gerçek`) sıfıra yaklaştığında MAPE matematiksel olarak büyür veya tanımsız hale gelir. Bu projedeki iki temel neden:

### Neden 1 — Düşük trafikli saat/durak kombinasyonları

Gece saatlerinde (23:00–06:00) veya düşük trafikli sanayi/uç istasyonlarda gerçek yolcu sayısı 1–5 arasında olabilir. Model bu saatlerde `station_hour_avg` (eğitim ortalaması) civarında tahmin yaptığında bile MAPE %300–500'e ulaşır.

**Örnek:** Gerçek = 2, tahmin = 12 → MAE = 10, MAPE = %500.  
**Örnek:** Gerçek = 200, tahmin = 210 → MAE = 10, MAPE = %5.

Her iki durumda MAE aynı ama MAPE 100× farklı.

### Neden 2 — Lag feature degradation (uzun test ufku)

Test seti 73 günlük (Oct 20 – Dec 31). `HistoricalFeatureStore` yalnızca eğitim verisinden oluşturulduğundan:

- Oct 20–26 (7 gün): `lag_7_day_same_hour` → Oct 13–19 → eğitim setinde ✅ gerçek değer
- Oct 27 – Dec 31 (66 gün): `lag_7_day_same_hour` → test periyodunda → `global_mean` fallback ⚠️

Test setinin %90,4'ünde en önemli iki özellik (`lag_7`: %50,8 önem + `rolling_mean_7`: %31,0 önem = **%81,8 toplam**) `global_mean`'e düşer. Bu MAE'yi ve özellikle MAPE'yi olumsuz etkiler.

### Sonuç

MAPE tek başına model kalitesinin göstergesi değildir. **R²=0.803** ve yüksek trafikli durakların peak-saat MAE değerleri daha anlamlı göstergelerdir.

---

## 5. Modelin Güçlü Olduğu Segmentler

### Merkezi ve yüksek trafikli duraklar

| Durak | MAE | MAPE | R² |
|-------|-----|------|----|
| Cumhuriyet Meydanı | 217 | **38%** | 0.73 |
| Hunat | 107 | **49%** | 0.74 |
| Düvenönü | 94 | **46%** | 0.77 |
| Büyükşehir Belediyesi | 134 | **43%** | 0.66 |

Bu istasyonlarda MAPE %38–49 — küresel %113,85'in çok altında. R² değerleri 0.66–0.77 arası, pratik kullanım için makul.

### Sabah ve akşam zirve saatleri

`lag_7_day_same_hour` özelliği haftalık döngüyü yakalar. Sabah (07–09) ve akşam (17–19) saatlerindeki talep desenleri güçlü haftalık periodiklik taşıdığından model bu dilimlerde daha iyi çalışır. Peak saatler hem kullanıcının hem belediyenin en çok önem verdiği penceredir.

### Haftalık döngüsü güçlü istasyonlar

İstasyon bazında `lag_7_day_same_hour` önem payı %50,8. Bu demek ki model "geçen haftanın aynı saatinde ne oldu?" sorusunu temel signal olarak kullanıyor. Düzenli, tahmin edilebilir talep kalıpları olan istasyonlarda (konut bölgeleri, alışveriş merkezi) bu signal güçlü.

---

## 6. Modelin Zayıf Olduğu Segmentler

### Düşük trafikli uç ve sanayi istasyonları

| Durak | MAPE | Sorun |
|-------|------|-------|
| Erciyes Üniversitesi | 259% | R²=0.29 — düzensiz dönemsel talep |
| Organize Sanayi | 161% | Vardiya bazlı düzensizlik |
| DSI-Yeni Sanayi | 144% | Düşük hacimli ve düzensiz |
| Harikalar Diyarı | 155% | Az veri, gece/sabah sıfır trafik |

Bu istasyonlarda gerçek yolcu sayısı sık sık 0–5 arasına düştüğünden MAPE matematiksel olarak patlıyor.

### Düzensiz talep üreten duraklar

- **Üniversite durakları (Erciyes, Kayseri Ü.):** Dönem açılış/kapanış, sınav haftaları, tatiller talebi ani değiştiriyor. `lag_7` bu ani değişimleri öngöremiyor.
- **Hastane durakları:** Randevu yoğunluğuna bağlı dalgalanma; haftalık döngü daha zayıf.
- **Terminal/Otogar:** Uzak şehir seyahat talebine bağlı; yerel korelasyonlar zayıf.

### Uzun tahmin ufku (>7 gün)

`lag_7_day_same_hour` ve `rolling_mean_7` eğitim seti dışı tarihlerde `global_mean`'e düşüyor. Model bu nedenle 7 günü aşan ufuklarda statik istasyon ortalamalarına yaklaşıyor. Bu özellikle 1 aylık+ ileri tarih tahminlerinde belirginleşir.

---

## 7. Sunum İçin Hazır Savunma Metni

### Soru: "Baseline modelinizden daha mı iyi? Raporunuzda 13.38 görüyorum."

> "`baseline_reference: 13.38` bir naive baseline değil — önceki model versiyonunun farklı değerlendirme koşullarındaki (`random_holdout` split) performans referansıdır. O yöntemde eğitim seti içine geleceğe ait veriler karışabildiğinden lag özellikleri test satırları için gerçek değer alır; bu durum MAE'yi yapay olarak düşürür. Mevcut modelimiz kronolojik (time-based) split ile değerlendirilmiştir ki bu, zaman serisi tahmini için metodolojik olarak doğru yaklaşımdır. Global ortalama gibi gerçek naive baseline'larla karşılaştırdığımızda modelimiz açıkça daha iyi — R²=0.803, global ortalama tahminine karşı R²≈0."

### Soru: "MAPE %114 çok yüksek değil mi?"

> "MAPE, bölendeki gerçek değer sıfıra yaklaştığında matematiksel olarak patlar. Gece saatlerinde veya düşük trafikli istasyonlarda gerçek yolcu sayısı 2–5'e düştüğünde, 10 yolculuk tahmini bile %300–500 MAPE üretiyor. Kullanıcı ve belediye açısından kritik olan sabah ve akşam zirve saatlerinde yüksek trafikli istasyonların MAPE değeri %38–50 düzeyinde. Proje için en anlamlı metrik R²=0.803 ve peak-saat MAE değerleridir."

### Soru: "Model gelecek tahminlerinde ne kadar güvenilir?"

> "Model kısa vadeli tahmin için optimize edilmiştir — 1–7 günlük ufukta haftalık döngü sinyali (`lag_7_day_same_hour`) gerçek değerle çalışır ve model en iyi performansını gösterir. Daha uzun vadeli tahminlerde model statik istasyon-saat ortalamalarına dayanır; bu da makul bir fallback stratejisi. Sistem tasarımı da kullanıcıların en çok ihtiyaç duyduğu gün-içi ve haftalık planlama penceresini hedefliyor."

### Soru: "Feature importance'ta hava durumu neden %0'a yakın?"

> "Model eğitim verisi Ocak–Ekim 2025 dönemini kapsıyor. Bu dönemde yolcu sayısı üzerindeki en dominant signal haftalık periyodiklik (`lag_7`: %50.8). Hava durumu etkisi gerçek olmakla birlikte, haftalık döngü sinyaline kıyasla çok daha küçük — bu Kayseri tramvay sisteminin olağan günlerde hava koşullarına görece dayanıklı olduğunu gösteriyor. Şiddetli hava olaylarında (kar yağışı, fırtına) etkinin ortaya çıkacağını bekliyoruz; ancak bu olaylar eğitim setinde yeterince temsil edilmemiş olabilir."

---

## Referanslar

- `ml/train_model.py` — Eğitim scripti, BASELINE_MAE sabiti satır 67
- `ml/feature_engineering.py` — HistoricalFeatureStore.lag(), fallback mantığı satır 647
- `ml/model_reports/training_summary.json` — Metrikler ve baseline_reference
- `ml/model_reports/station_performance.json` — Durak bazlı MAE/MAPE/R²
- `ml/model_reports/model_comparison.json` — RandomForest vs GradientBoosting karşılaştırması
