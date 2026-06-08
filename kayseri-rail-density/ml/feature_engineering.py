"""
Gelişmiş feature engineering — gerçek tatil (JSON), gerçek hava (Open-Meteo CSV)
ve gerçek etkinlik/maç (JSON) verisi kullanır.
2026 tahmini için Open-Meteo forecast öncelikli, yoksa mevsimsel ortalama fallback.
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

_ML_DIR = os.path.dirname(os.path.abspath(__file__))
_ASSETS_DIR = os.path.join(_ML_DIR, "..", "assets", "data")

# ── Özellik listeleri ─────────────────────────────────────────────────────────

LEGACY_FEATURE_NAMES: list[str] = [
    "durak_id_num",
    "saat",
    "day",
    "month",
    "day_of_week",
    "is_weekend",
    "station_avg",
    "station_hour_avg",
    "hour_avg",
    "day_of_week_hour_avg",
]

ADVANCED_FEATURE_NAMES: list[str] = [
    "season",
    "is_peak_hour",
    "is_morning_peak",
    "is_evening_peak",
    # Tatil — JSON tabanlı
    "is_holiday",            # resmî tatil (is_official_holiday'in yeniden adlandırılmışı)
    "is_religious_holiday",
    "is_national_holiday",
    "is_holiday_eve",
    "holiday_impact_score",
    # Okul / üniversite takvimi
    "is_school_term",
    "is_midterm_break",
    "is_university_term",
    "is_university_break",
    "is_university_exam_week",
    # İstasyon
    "is_transfer_station",
    "station_type_encoded",
    # Lag / rolling
    "lag_1_day_same_hour",
    "lag_7_day_same_hour",
    "rolling_mean_7",
    "rolling_mean_30",
    # Etkinlik — JSON tabanlı
    "has_event",
    "is_event_day",
    "is_match_day",
    "is_exam_week",
    "event_type_encoded",
    "event_impact_score",
    # Hava — gerçek Open-Meteo CSV + forecast
    "temperature",
    "precipitation",
    "rain",
    "snowfall",
    "windSpeed",
    "windGusts",
    "windDirection",
    "weather_impact_score",
]

FEATURE_NAMES: list[str] = LEGACY_FEATURE_NAMES + ADVANCED_FEATURE_NAMES

MORNING_PEAK_HOURS = (7, 8, 9)
EVENING_PEAK_HOURS = (17, 18, 19)

DATE_RANGES: dict[str, list[tuple[str, str]]] = {
    "school_term": [
        ("2024-09-09", "2025-01-17"),
        ("2025-02-10", "2025-06-13"),
        ("2025-09-08", "2026-01-16"),
        ("2026-02-09", "2026-06-12"),
    ],
    "school_midterm": [
        ("2025-01-20", "2025-01-31"),
        ("2025-04-14", "2025-04-18"),
        ("2026-01-19", "2026-01-30"),
        ("2026-04-13", "2026-04-17"),
    ],
    "university_term": [
        ("2024-09-16", "2025-01-24"),
        ("2025-02-03", "2025-06-20"),
        ("2025-09-15", "2026-01-23"),
        ("2026-02-02", "2026-06-19"),
    ],
    "university_break": [
        ("2025-01-25", "2025-02-02"),
        ("2025-06-21", "2025-09-14"),
        ("2026-01-24", "2026-02-01"),
        ("2026-06-20", "2026-09-13"),
    ],
    # Final ve midterm sınav haftaları (universitede yoğunluk artar)
    "university_exam_week": [
        ("2025-01-06", "2025-01-17"),   # 2024-25 güz finali
        ("2025-04-07", "2025-04-18"),   # 2024-25 bahar midtermi
        ("2025-06-02", "2025-06-20"),   # 2024-25 bahar finali
        ("2025-11-10", "2025-11-21"),   # 2025-26 güz midtermi
        ("2026-01-05", "2026-01-16"),   # 2025-26 güz finali
        ("2026-04-06", "2026-04-17"),   # 2025-26 bahar midtermi
        ("2026-06-01", "2026-06-19"),   # 2025-26 bahar finali
    ],
}

STATION_TYPE_MAP: dict[str, int] = {
    "OTHER": 0,
    "RESIDENTIAL": 1,
    "CENTER": 2,
    "UNIVERSITY": 3,
    "HOSPITAL": 4,
    "INDUSTRIAL": 5,
    "TERMINAL": 6,
    "TRANSFER": 7,
    "STADIUM": 8,
    "MALL": 9,
}

STATION_TYPE_OVERRIDES: dict[str, str] = {
    "1006048": "UNIVERSITY",
    "1006071": "UNIVERSITY",
    "1006049": "HOSPITAL",
    "1006061": "HOSPITAL",
    "1006060": "HOSPITAL",
    "1006019": "CENTER",
    "1006001": "INDUSTRIAL",
    "1006017": "INDUSTRIAL",
    "1006013": "INDUSTRIAL",
    "1006009": "STADIUM",
    "1006066": "MALL",
    "1006028": "TERMINAL",
    "1006057": "TERMINAL",
    "1006025": "RESIDENTIAL",
    "1006039": "RESIDENTIAL",
}

TRANSFER_STATION_IDS: frozenset[str] = frozenset({"1006019", "1006028", "1006057"})

EVENT_TYPE_MAP: dict[str, int] = {
    "NONE": 0,
    "MATCH": 1,
    "MEETING": 2,
    "EXAM": 3,
    "GRADUATION": 4,
    "FAIR": 5,
    "CONCERT": 6,
    "OTHER": 7,
}

IMPACT_SCORE: dict[str, float] = {
    "NONE": 0.0,
    "LOW": 0.25,
    "MEDIUM": 0.5,
    "HIGH": 0.75,
    "CRITICAL": 1.0,
}


# ── HolidayLoader ─────────────────────────────────────────────────────────────


class HolidayLoader:
    """Reads turkey-official-holidays-{year}.json for holiday queries."""

    _cache: dict[int, list[dict]] = {}

    @classmethod
    def _load_year(cls, year: int) -> list[dict]:
        if year not in cls._cache:
            path = os.path.join(
                _ASSETS_DIR, "holidays", f"turkey-official-holidays-{year}.json"
            )
            if not os.path.exists(path):
                cls._cache[year] = []
            else:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cls._cache[year] = data.get("holidays", [])
        return cls._cache[year]

    @classmethod
    def get_holiday_info(cls, date_str: str) -> dict[str, Any]:
        year = int(date_str[:4])
        holidays = cls._load_year(year)

        is_official = False
        is_religious = False
        is_national = False
        transit_impact: str | None = None

        for h in holidays:
            if h["startDate"] <= date_str <= h["endDate"]:
                is_official = True
                if transit_impact is None:
                    transit_impact = h.get("expectedTransitImpact", "medium")
                htype = h.get("type", "")
                if htype == "religious_holiday":
                    is_religious = True
                elif htype == "national_holiday":
                    is_national = True

        next_day = (
            datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)
        ).strftime("%Y-%m-%d")
        is_eve = any(h["startDate"] == next_day for h in holidays)

        if is_official:
            if transit_impact == "high":
                impact_score = 0.75
            elif transit_impact == "low":
                impact_score = 0.25
            else:
                impact_score = 0.5
        elif is_eve:
            impact_score = 0.5
        else:
            impact_score = 0.0

        return {
            "is_official_holiday": int(is_official),
            "is_religious_holiday": int(is_religious),
            "is_national_holiday": int(is_national),
            "is_holiday_eve": int(is_eve),
            "holiday_impact_score": impact_score,
        }


# ── EventLoader ───────────────────────────────────────────────────────────────


class EventLoader:
    """
    assets/data/events/events-{year}.json dosyasından etkinlik verisi yükler.
    MOCK_EVENTS'in yerini alır; has_event, is_event_day, is_match_day,
    is_exam_week, event_type_encoded, event_impact_score üretir.
    """

    _cache: dict[int, list[dict]] = {}

    @classmethod
    def _load_year(cls, year: int) -> list[dict]:
        if year not in cls._cache:
            path = os.path.join(_ASSETS_DIR, "events", f"events-{year}.json")
            if not os.path.exists(path):
                cls._cache[year] = []
            else:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cls._cache[year] = data.get("events", [])
        return cls._cache[year]

    @classmethod
    def get_event_features(cls, durak_id: str, date_str: str, hour: int) -> dict[str, Any]:
        year = int(date_str[:4])
        events = cls._load_year(year)

        has_event = 0
        is_event_day = 0
        is_match_day = 0
        is_exam_week = 0
        best_score = 0.0
        best_type = 0

        for ev in events:
            if ev.get("date") != date_str:
                continue
            affected = ev.get("affectedStationIds", [])
            if durak_id not in affected:
                continue
            if hour < ev.get("startHour", 0) or hour > ev.get("endHour", 23):
                continue

            is_event_day = 1
            ev_type = ev.get("eventType", "OTHER")
            score = IMPACT_SCORE.get(ev.get("impactLevel", "NONE"), 0.0)

            if ev_type == "MATCH":
                is_match_day = 1
            if ev_type in ("EXAM", "GRADUATION"):
                is_exam_week = 1

            if score >= best_score:
                best_score = score
                best_type = EVENT_TYPE_MAP.get(ev_type, 0)
                has_event = 1

        return {
            "has_event": has_event,
            "is_event_day": is_event_day,
            "is_match_day": is_match_day,
            "is_exam_week": is_exam_week,
            "event_type_encoded": best_type,
            "event_impact_score": best_score,
        }


# ── WeatherLoader ─────────────────────────────────────────────────────────────

_WEATHER_COLS = (
    "temperature",
    "precipitation",
    "rain",
    "snowfall",
    "windSpeed",
    "windGusts",
    "windDirection",
)
_DISTRICTS = ("melikgazi", "talas", "kocasinan")
_ZERO_WEATHER: dict[str, float] = {c: 0.0 for c in _WEATHER_COLS}


class WeatherLoader:
    """
    Gerçek Open-Meteo CSV verisi (2025) + forecast (2026+) + mevsimsel fallback.

    Öncelik sırası:
      1. Forecast (set_forecast ile yüklenen, genellikle gelecek 16 gün)
      2. Gerçek 2025 CSV verisi
      3. Mevsimsel ortalama (aynı ay/saat için 2025 ortalaması)
    """

    _exact: dict[tuple[str, int], dict[str, float]] | None = None
    _seasonal: dict[tuple[int, int], dict[str, float]] | None = None
    _forecast: dict[tuple[str, int], dict[str, float]] = {}

    @classmethod
    def set_forecast(cls, forecast: dict[tuple[str, int], dict[str, float]]) -> None:
        """train_model.py tarafından çağrılır; 2026 tahminleri için forecast verisini yükler."""
        cls._forecast = forecast
        n = len(forecast)
        print(f"[WeatherLoader] {n} saatlik forecast verisi yüklendi ({n // 24 if n else 0} gün).")

    @classmethod
    def _init(cls) -> None:
        if cls._exact is not None:
            return

        raw: dict[tuple[str, int], list[dict[str, float]]] = {}

        for district in _DISTRICTS:
            path = os.path.join(
                _ASSETS_DIR, "weather", "2025", f"{district}-hourly-weather-2025.csv"
            )
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    date_str = row["date"]
                    hour = int(row["time"].split(":")[0])
                    vals = {c: float(row[c]) for c in _WEATHER_COLS}
                    raw.setdefault((date_str, hour), []).append(vals)

        cls._exact = {}
        for key, district_vals in raw.items():
            n = len(district_vals)
            cls._exact[key] = {
                c: sum(v[c] for v in district_vals) / n for c in _WEATHER_COLS
            }

        # Mevsimsel ortalamalar: (ay, saat) → 2025 gerçek verisinden
        seasonal_raw: dict[tuple[int, int], list[dict[str, float]]] = {}
        for (date_str, hour), vals in cls._exact.items():
            month = int(date_str[5:7])
            seasonal_raw.setdefault((month, hour), []).append(vals)

        cls._seasonal = {}
        for skey, val_list in seasonal_raw.items():
            n = len(val_list)
            cls._seasonal[skey] = {
                c: sum(v[c] for v in val_list) / n for c in _WEATHER_COLS
            }

    @classmethod
    def get_weather(cls, date_str: str, hour: int) -> dict[str, float]:
        cls._init()
        # 1. Forecast önceliği (2026 ve yakın gelecek)
        fw = cls._forecast.get((date_str, hour))
        if fw is not None:
            return fw
        # 2. Gerçek 2025 CSV verisi
        w = cls._exact.get((date_str, hour))  # type: ignore[union-attr]
        if w is not None:
            return w
        # 3. Mevsimsel ortalama fallback
        month = int(date_str[5:7])
        return cls._seasonal.get((month, hour), _ZERO_WEATHER)  # type: ignore[union-attr]

    @classmethod
    def compute_impact_score(cls, w: dict[str, float]) -> float:
        if w.get("snowfall", 0.0) > 0.5:
            return IMPACT_SCORE["HIGH"]
        if w.get("precipitation", 0.0) > 5.0 or w.get("windSpeed", 0.0) > 40.0:
            return IMPACT_SCORE["HIGH"]
        if w.get("precipitation", 0.0) > 2.0:
            return IMPACT_SCORE["MEDIUM"]
        if w.get("windSpeed", 0.0) > 25.0:
            return IMPACT_SCORE["LOW"]
        return IMPACT_SCORE["NONE"]

    @classmethod
    def compute_impact_level(cls, score: float) -> str:
        if score >= 0.75:
            return "HIGH"
        if score >= 0.5:
            return "MEDIUM"
        if score >= 0.25:
            return "LOW"
        return "NONE"


# ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────


def _in_ranges(ymd: str, ranges: list[tuple[str, str]]) -> bool:
    return any(start <= ymd <= end for start, end in ranges)


def season_from_month(month: int) -> int:
    if month in (12, 1, 2):
        return 0
    if month in (3, 4, 5):
        return 1
    if month in (6, 7, 8):
        return 2
    return 3


def resolve_station_type_encoded(durak_id: str) -> int:
    label = STATION_TYPE_OVERRIDES.get(str(durak_id), "OTHER")
    return STATION_TYPE_MAP.get(label, 0)


# ── HistoricalFeatureStore ────────────────────────────────────────────────────


@dataclass
class HistoricalFeatureStore:
    """(durakId, date, hour) -> yolcuSayisi; eksikse global_mean."""

    global_mean: float
    _index: dict[tuple[str, date, int], float]

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame, global_mean: float) -> HistoricalFeatureStore:
        index: dict[tuple[str, date, int], float] = {}
        for row in df.itertuples(index=False):
            d = row.tarih
            if isinstance(d, pd.Timestamp):
                d_key = d.date()
            elif isinstance(d, datetime):
                d_key = d.date()
            else:
                d_key = pd.to_datetime(d).date()
            key = (str(row.durakId), d_key, int(row.saat))
            index[key] = float(row.yolcuSayisi)
        return cls(global_mean=global_mean, _index=index)

    def _get(self, durak_id: str, d: date, hour: int) -> float | None:
        return self._index.get((str(durak_id), d, int(hour)))

    def lag(self, durak_id: str, d: date, hour: int, days: int) -> float:
        val = self._get(durak_id, d - timedelta(days=days), hour)
        return float(val) if val is not None else self.global_mean

    def rolling_mean(self, durak_id: str, d: date, hour: int, window: int) -> float:
        vals: list[float] = []
        for offset in range(1, window + 1):
            v = self._get(durak_id, d - timedelta(days=offset), hour)
            if v is not None:
                vals.append(v)
        return float(np.mean(vals)) if vals else self.global_mean


# ── Takvim öznitelikleri ──────────────────────────────────────────────────────


def add_calendar_features(t: pd.Series) -> pd.DataFrame:
    p = t.dt
    dow = p.dayofweek.astype(np.int32)
    month = p.month.astype(np.int32)
    return pd.DataFrame(
        {
            "day": p.day.astype(np.int32),
            "month": month,
            "day_of_week": dow,
            "is_weekend": (dow >= 5).astype(np.int32),
            "season": month.map(season_from_month).astype(np.int32),
        },
        index=t.index,
    )


def compute_aggregates(f: pd.DataFrame) -> dict[str, Any]:
    station_avg = f.groupby("durakId", observed=True)["yolcuSayisi"].mean()
    sh = f.groupby(["durakId", "saat"], observed=True)["yolcuSayisi"].mean()
    hour_avg = f.groupby("saat", observed=True)["yolcuSayisi"].mean()
    f2 = f.copy()
    f2["_dow"] = f2["tarih"].dt.dayofweek
    dow_h = f2.groupby(["_dow", "saat"], observed=True)["yolcuSayisi"].mean()
    return {
        "station_avg": {str(k): float(v) for k, v in station_avg.to_dict().items()},
        "station_hour": {(str(a), int(b)): float(c) for (a, b), c in sh.items()},
        "hour": {int(h): float(v) for h, v in hour_avg.items()},
        "dow_hour": {(int(a), int(b)): float(c) for (a, b), c in dow_h.items()},
    }


def _apply_aggregates_vec(
    f: pd.DataFrame,
    aggs: dict[str, Any],
    global_mean: float,
) -> pd.DataFrame:
    dows = f["tarih"].dt.dayofweek
    stat_map = aggs["station_avg"]
    out = f.copy()
    out["station_avg"] = out["durakId"].astype(str).map(stat_map)
    sh = aggs["station_hour"]
    out["station_hour_avg"] = [
        sh.get((str(ri), int(s)), np.nan) for ri, s in zip(out["durakId"], out["saat"])
    ]
    hmap = aggs["hour"]
    out["hour_avg"] = out["saat"].map(lambda s: hmap.get(int(s), np.nan))
    dhm = aggs["dow_hour"]
    out["day_of_week_hour_avg"] = [
        dhm.get((int(dow), int(s)), np.nan) for dow, s in zip(dows, out["saat"])
    ]
    for c in ("station_avg", "station_hour_avg", "hour_avg", "day_of_week_hour_avg"):
        out[c] = out[c].astype(float).fillna(global_mean)
    return out


def _row_date(d: Any) -> date:
    if isinstance(d, pd.Timestamp):
        return d.date()
    if isinstance(d, datetime):
        return d.date()
    return pd.to_datetime(d).date()


# ── Gelişmiş özellik matrisi ──────────────────────────────────────────────────


def build_advanced_features(
    base: pd.DataFrame,
    historical: HistoricalFeatureStore,
) -> pd.DataFrame:
    n = len(base)
    adv = pd.DataFrame(index=base.index)

    hours = base["saat"].astype(int).to_numpy()
    adv["is_morning_peak"] = np.isin(hours, MORNING_PEAK_HOURS).astype(np.int32)
    adv["is_evening_peak"] = np.isin(hours, EVENING_PEAK_HOURS).astype(np.int32)
    adv["is_peak_hour"] = (
        (adv["is_morning_peak"] == 1) | (adv["is_evening_peak"] == 1)
    ).astype(np.int32)

    ymd_list: list[str] = []
    dates: list[date] = []
    for ts in base["tarih"]:
        d = _row_date(ts)
        dates.append(d)
        ymd_list.append(d.isoformat())

    # ── Tatil özellikleri (JSON tabanlı) ─────────────────────────────────────
    holiday_cache: dict[str, dict[str, Any]] = {}
    is_holiday_arr = np.zeros(n, dtype=np.int32)
    is_religious = np.zeros(n, dtype=np.int32)
    is_national = np.zeros(n, dtype=np.int32)
    is_eve = np.zeros(n, dtype=np.int32)
    holiday_impact = np.zeros(n, dtype=np.float32)

    for i, ymd in enumerate(ymd_list):
        if ymd not in holiday_cache:
            holiday_cache[ymd] = HolidayLoader.get_holiday_info(ymd)
        info = holiday_cache[ymd]
        is_holiday_arr[i] = info["is_official_holiday"]
        is_religious[i] = info["is_religious_holiday"]
        is_national[i] = info["is_national_holiday"]
        is_eve[i] = info["is_holiday_eve"]
        holiday_impact[i] = info["holiday_impact_score"]

    adv["is_holiday"] = is_holiday_arr
    adv["is_religious_holiday"] = is_religious
    adv["is_national_holiday"] = is_national
    adv["is_holiday_eve"] = is_eve
    adv["holiday_impact_score"] = holiday_impact

    # ── Okul / üniversite takvimi ─────────────────────────────────────────────
    adv["is_school_term"] = [int(_in_ranges(y, DATE_RANGES["school_term"])) for y in ymd_list]
    adv["is_midterm_break"] = [int(_in_ranges(y, DATE_RANGES["school_midterm"])) for y in ymd_list]
    adv["is_university_term"] = [int(_in_ranges(y, DATE_RANGES["university_term"])) for y in ymd_list]
    adv["is_university_break"] = [int(_in_ranges(y, DATE_RANGES["university_break"])) for y in ymd_list]
    adv["is_university_exam_week"] = [
        int(_in_ranges(y, DATE_RANGES["university_exam_week"])) for y in ymd_list
    ]

    # ── İstasyon özellikleri ──────────────────────────────────────────────────
    durak_ids = base["durakId"].astype(str).to_numpy()
    adv["is_transfer_station"] = [int(d in TRANSFER_STATION_IDS) for d in durak_ids]
    adv["station_type_encoded"] = [resolve_station_type_encoded(d) for d in durak_ids]

    # ── Lag / rolling özellikler ──────────────────────────────────────────────
    lag1 = np.zeros(n, dtype=np.float32)
    lag7 = np.zeros(n, dtype=np.float32)
    roll7 = np.zeros(n, dtype=np.float32)
    roll30 = np.zeros(n, dtype=np.float32)
    for i in range(n):
        d_id = str(durak_ids[i])
        d = dates[i]
        h = int(hours[i])
        lag1[i] = historical.lag(d_id, d, h, 1)
        lag7[i] = historical.lag(d_id, d, h, 7)
        roll7[i] = historical.rolling_mean(d_id, d, h, 7)
        roll30[i] = historical.rolling_mean(d_id, d, h, 30)
    adv["lag_1_day_same_hour"] = lag1
    adv["lag_7_day_same_hour"] = lag7
    adv["rolling_mean_7"] = roll7
    adv["rolling_mean_30"] = roll30

    # ── Etkinlik + hava özellikleri (tek döngü) ───────────────────────────────
    has_ev = np.zeros(n, dtype=np.int32)
    is_ev_day = np.zeros(n, dtype=np.int32)
    is_match = np.zeros(n, dtype=np.int32)
    is_exam = np.zeros(n, dtype=np.int32)
    ev_type_arr = np.zeros(n, dtype=np.int32)
    ev_score = np.zeros(n, dtype=np.float32)

    temp = np.zeros(n, dtype=np.float32)
    precip = np.zeros(n, dtype=np.float32)
    rain = np.zeros(n, dtype=np.float32)
    snowfall = np.zeros(n, dtype=np.float32)
    wind_speed = np.zeros(n, dtype=np.float32)
    wind_gusts = np.zeros(n, dtype=np.float32)
    wind_dir = np.zeros(n, dtype=np.float32)
    w_score = np.zeros(n, dtype=np.float32)

    weather_cache: dict[tuple[str, int], dict[str, float]] = {}

    for i in range(n):
        ymd = ymd_list[i]
        h = int(hours[i])
        d_id = str(durak_ids[i])

        # Etkinlik (EventLoader — JSON tabanlı)
        ev = EventLoader.get_event_features(d_id, ymd, h)
        has_ev[i] = ev["has_event"]
        is_ev_day[i] = ev["is_event_day"]
        is_match[i] = ev["is_match_day"]
        # is_exam_week: etkinlik JSON'u VEYA takvim aralığı
        exam_from_cal = int(_in_ranges(ymd, DATE_RANGES["university_exam_week"]))
        is_exam[i] = max(ev["is_exam_week"], exam_from_cal)
        ev_type_arr[i] = ev["event_type_encoded"]
        ev_score[i] = ev["event_impact_score"]

        # Hava (WeatherLoader — CSV + forecast + mevsimsel)
        wkey = (ymd, h)
        if wkey not in weather_cache:
            weather_cache[wkey] = WeatherLoader.get_weather(ymd, h)
        w = weather_cache[wkey]
        temp[i] = w["temperature"]
        precip[i] = w["precipitation"]
        rain[i] = w["rain"]
        snowfall[i] = w["snowfall"]
        wind_speed[i] = w["windSpeed"]
        wind_gusts[i] = w["windGusts"]
        wind_dir[i] = w["windDirection"]
        w_score[i] = WeatherLoader.compute_impact_score(w)

    adv["has_event"] = has_ev
    adv["is_event_day"] = is_ev_day
    adv["is_match_day"] = is_match
    adv["is_exam_week"] = is_exam
    adv["event_type_encoded"] = ev_type_arr
    adv["event_impact_score"] = ev_score
    adv["temperature"] = temp
    adv["precipitation"] = precip
    adv["rain"] = rain
    adv["snowfall"] = snowfall
    adv["windSpeed"] = wind_speed
    adv["windGusts"] = wind_gusts
    adv["windDirection"] = wind_dir
    adv["weather_impact_score"] = w_score

    return adv.astype(np.float32)


def build_feature_frame(
    f: pd.DataFrame,
    durak_to_num: dict[str, int],
    aggs: dict[str, Any],
    global_mean: float,
    historical: HistoricalFeatureStore,
) -> pd.DataFrame:
    base = f.reset_index(drop=True)
    cal = add_calendar_features(base["tarih"])
    dfn = pd.concat([base[["saat"]], cal], axis=1)
    dfn["durak_id_num"] = base["durakId"].astype(str).map(lambda s: durak_to_num.get(s, 0))
    extra = _apply_aggregates_vec(base, aggs, global_mean)
    for c in LEGACY_FEATURE_NAMES:
        if c in extra.columns:
            dfn[c] = extra[c].values
        elif c == "saat":
            dfn["saat"] = base["saat"].astype(np.int32)
    adv = build_advanced_features(base, historical)
    dfn = pd.concat([dfn, adv], axis=1)
    return dfn


def build_feature_array(
    f: pd.DataFrame,
    durak_to_num: dict[str, int],
    aggs: dict[str, Any],
    global_mean: float,
    historical: HistoricalFeatureStore,
) -> np.ndarray:
    dfn = build_feature_frame(f, durak_to_num, aggs, global_mean, historical)
    return dfn[FEATURE_NAMES].to_numpy(dtype=np.float32)


def build_durak_id_num(df: pd.DataFrame) -> dict[str, int]:
    all_ids = sorted(
        {str(x) for x in df["durakId"]},
        key=lambda s: int(s) if s.isdigit() else 0,
    )
    return {sid: i for i, sid in enumerate(all_ids)}


# ── Doğrulama ─────────────────────────────────────────────────────────────────


def verify_implementation() -> None:
    """Gerçek veri entegrasyonunu doğrular."""
    errors: list[str] = []

    def check(label: str, got: Any, expected: Any) -> None:
        if got != expected:
            errors.append(f"{label}: beklenen={expected}, alınan={got}")

    # Tatil doğrulamaları
    h = HolidayLoader.get_holiday_info("2026-03-20")
    check("2026-03-20 is_official_holiday", h["is_official_holiday"], 1)
    check("2026-03-20 is_religious_holiday", h["is_religious_holiday"], 1)

    h = HolidayLoader.get_holiday_info("2026-05-27")
    check("2026-05-27 is_official_holiday", h["is_official_holiday"], 1)

    h = HolidayLoader.get_holiday_info("2026-10-29")
    check("2026-10-29 is_official_holiday", h["is_official_holiday"], 1)
    check("2026-10-29 is_national_holiday", h["is_national_holiday"], 1)

    h = HolidayLoader.get_holiday_info("2025-01-15")
    check("2025-01-15 is_official_holiday", h["is_official_holiday"], 0)

    # EventLoader doğrulaması
    ev = EventLoader.get_event_features("1006009", "2025-03-15", 19)
    check("2025-03-15 saat=19 durak=1006009 is_match_day", ev["is_match_day"], 1)
    check("2025-03-15 saat=19 durak=1006009 has_event", ev["has_event"], 1)

    ev2 = EventLoader.get_event_features("1006001", "2025-03-15", 19)
    check("2025-03-15 saat=19 durak=1006001 is_match_day (etkilenmiyor)", ev2["is_match_day"], 0)

    # is_university_exam_week doğrulaması (takvim)
    check("2025-01-10 exam_week", int(_in_ranges("2025-01-10", DATE_RANGES["university_exam_week"])), 1)
    check("2025-03-01 not exam_week", int(_in_ranges("2025-03-01", DATE_RANGES["university_exam_week"])), 0)

    # WeatherLoader doğrulaması
    WeatherLoader._init()
    if not WeatherLoader._exact:
        errors.append("WeatherLoader: 2025 CSV dosyaları yüklenemedi")
    else:
        w = WeatherLoader.get_weather("2025-06-15", 14)
        if w is _ZERO_WEATHER:
            errors.append("WeatherLoader: 2025-06-15 14:00 için gerçek veri bulunamadı")

        w2026 = WeatherLoader.get_weather("2026-06-15", 14)
        if w2026 is _ZERO_WEATHER:
            errors.append("WeatherLoader: 2026-06-15 14:00 mevsimsel ortalama hesaplanamadı")

    if errors:
        print("verify_implementation: HATALAR:")
        for e in errors:
            print(f"  ✗ {e}")
    else:
        print("verify_implementation: TÜM KONTROLLER BAŞARILI")


if __name__ == "__main__":
    verify_implementation()
