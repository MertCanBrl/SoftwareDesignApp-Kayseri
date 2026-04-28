export type PassengerRow = {
  tarih: string;
  durakId: string;
  durakAd: string;
  saat: number;
  yolcuSayisi: number;
};

/** Map + ekranlar: gerçek veya ML tahmin satırı (tarih, sayım ve tür) */
export type DisplayPassengerRow = {
  tarih: string;
  durakId: string;
  durakAd: string;
  saat: number;
  yolcuSayisi: number;
  dataType: 'actual' | 'prediction';
};

/** ml/train_model.py çıktısı (gün JSON dosyaları) */
export type PredictionFileRow = {
  durakId: string;
  durakAd: string;
  date: string;
  hour: number;
  predictedPassengerCount: number;
};

export type StationRecord = {
  durakId: string;
  durakAd: string;
  latitude: number;
  longitude: number;
  /** OSM bulunamadıysa yaklaşık konum */
  approximate?: boolean;
};

export type HourlyPoint = { saat: number; yolcuSayisi: number };
