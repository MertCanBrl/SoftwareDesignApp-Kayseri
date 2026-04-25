export type PassengerRow = {
  tarih: string;
  durakId: string;
  durakAd: string;
  saat: number;
  yolcuSayisi: number;
};

export type StationRecord = {
  durakId: string;
  durakAd: string;
  latitude: number;
  longitude: number;
  /** OSM bulunamadıysa yaklaşık konum */
  approximate?: boolean;
};

export type DensityLevel = 'low' | 'medium' | 'high' | 'very_high';

export type QuartileThresholds = {
  q1: number;
  q2: number;
  q3: number;
};

export type HourlyPoint = { saat: number; yolcuSayisi: number };
