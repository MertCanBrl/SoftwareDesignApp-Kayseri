"""
Gelişmiş feature engineering — context enrichment / transit network ile uyumlu.
Eksik event/weather verisinde deterministik mock + global_mean fallback kullanır.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

# --- Mevcut (legacy) özellikler — backward compatibility ---
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

# --- Yeni özellikler ---
ADVANCED_FEATURE_NAMES: list[str] = [
    "season",
    "is_peak_hour",
    "is_morning_peak",
    "is_evening_peak",
    "is_official_holiday",
    "is_religious_holiday",
    "is_holiday_eve",
    "is_school_term",
    "is_midterm_break",
    "is_university_term",
    "is_university_break",
    "is_transfer_station",
    "station_type_encoded",
    "lag_1_day_same_hour",
    "lag_7_day_same_hour",
    "rolling_mean_7",
    "rolling_mean_30",
    "has_event",
    "event_type_encoded",
    "event_impact_score",
    "temperature",
    "rain",
    "snow",
    "weather_impact_score",
]

FEATURE_NAMES: list[str] = LEGACY_FEATURE_NAMES + ADVANCED_FEATURE_NAMES

MORNING_PEAK_HOURS = (7, 8, 9)
EVENING_PEAK_HOURS = (17, 18, 19)

# --- Takvim (calendarContextConfig.ts ile uyumlu) ---
OFFICIAL_HOLIDAYS: frozenset[str] = frozenset(
    {
        "2025-01-01",
        "2025-03-30",
        "2025-03-31",
        "2025-04-01",
        "2025-04-23",
        "2025-05-01",
        "2025-05-19",
        "2025-06-06",
        "2025-06-07",
        "2025-06-08",
        "2025-06-09",
        "2025-07-15",
        "2025-08-30",
        "2025-10-28",
        "2025-10-29",
    }
)

RELIGIOUS_HOLIDAYS: frozenset[str] = frozenset(
    {
        "2025-03-30",
        "2025-03-31",
        "2025-04-01",
        "2025-06-06",
        "2025-06-07",
        "2025-06-08",
        "2025-06-09",
    }
)

HOLIDAY_EVES: frozenset[str] = frozenset({"2025-03-29", "2025-06-05", "2025-10-27"})

DATE_RANGES: dict[str, list[tuple[str, str]]] = {
    "school_term": [
        ("2024-09-09", "2025-01-17"),
        ("2025-02-10", "2025-06-13"),
    ],
    "school_midterm": [
        ("2025-01-20", "2025-01-31"),
        ("2025-04-14", "2025-04-18"),
    ],
    "university_term": [
        ("2024-09-16", "2025-01-24"),
        ("2025-02-03", "2025-06-20"),
    ],
    "university_break": [
        ("2025-01-25", "2025-02-02"),
        ("2025-06-21", "2025-09-14"),
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

MOCK_EVENTS: list[dict[str, Any]] = [
    {
        "eventType": "MATCH",
        "date": "2025-03-15",
        "startHour": 18,
        "endHour": 22,
        "impactLevel": "HIGH",
        "affectedStationGroupIds": ["1006008", "1006009", "1006010", "1006019"],
    },
    {
        "eventType": "MEETING",
        "date": "2025-04-12",
        "startHour": 14,
        "endHour": 18,
        "impactLevel": "MEDIUM",
        "affectedStationGroupIds": ["1006019", "1006020", "1006021"],
    },
    {
        "eventType": "EXAM",
        "date": "2025-06-10",
        "startHour": 8,
        "endHour": 17,
        "impactLevel": "MEDIUM",
        "affectedStationGroupIds": ["1006048", "1006049", "1006052", "1006047"],
    },
    {
        "eventType": "GRADUATION",
        "date": "2025-06-20",
        "startHour": 10,
        "endHour": 16,
        "impactLevel": "HIGH",
        "affectedStationGroupIds": ["1006048", "1006049", "1006052"],
    },
    {
        "eventType": "FAIR",
        "date": "2025-05-03",
        "startHour": 11,
        "endHour": 20,
        "impactLevel": "LOW",
        "affectedStationGroupIds": ["1006039", "1006040", "1006041"],
    },
]


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


def resolve_mock_weather(ymd: str, hour: int) -> dict[str, float | int]:
    """weatherContextProvider.ts ile uyumlu deterministik mock."""
    try:
        parsed = datetime.strptime(ymd, "%Y-%m-%d")
        month = parsed.month
        day_of_month = parsed.day
    except ValueError:
        month, day_of_month = 3, 1

    seed = sum(ord(c) for c in ymd) + hour + day_of_month

    if ymd == "2025-03-15" and hour >= 17:
        return {
            "temperature": 8.0,
            "rain": 1,
            "snow": 0,
            "weather_impact_score": IMPACT_SCORE["HIGH"],
        }
    if ymd == "2025-01-25":
        return {
            "temperature": -2.0,
            "rain": 0,
            "snow": 1,
            "weather_impact_score": IMPACT_SCORE["MEDIUM"],
        }
    if month >= 6 and month <= 8 and seed % 5 == 0:
        return {
            "temperature": 32.0,
            "rain": 0,
            "snow": 0,
            "weather_impact_score": IMPACT_SCORE["LOW"],
        }
    if seed % 7 == 0:
        temp = 6.0 if month <= 3 or month >= 11 else 14.0
        return {
            "temperature": temp,
            "rain": 1,
            "snow": 0,
            "weather_impact_score": IMPACT_SCORE["HIGH"],
        }
    if seed % 11 == 0:
        return {
            "temperature": 12.0,
            "rain": 0,
            "snow": 0,
            "weather_impact_score": IMPACT_SCORE["LOW"],
        }

    temp = (5 + (hour % 6)) if month <= 3 or month >= 11 else (15 + (hour % 8))
    return {
        "temperature": float(temp),
        "rain": 0,
        "snow": 0,
        "weather_impact_score": IMPACT_SCORE["NONE"],
    }


def resolve_event_features(durak_id: str, ymd: str, hour: int) -> tuple[int, int, float]:
    best_score = 0.0
    best_type = 0
    has_event = 0
    for ev in MOCK_EVENTS:
        if ev["date"] != ymd:
            continue
        if durak_id not in ev["affectedStationGroupIds"]:
            continue
        if hour < ev["startHour"] or hour > ev["endHour"]:
            continue
        score = IMPACT_SCORE.get(ev["impactLevel"], 0.0)
        if score >= best_score:
            best_score = score
            best_type = EVENT_TYPE_MAP.get(ev["eventType"], 0)
            has_event = 1
    return has_event, best_type, best_score


@dataclass
class HistoricalFeatureStore:
    """(durakId, date, hour) -> yolcuSayisi; eksikte global_mean."""

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

    adv["is_official_holiday"] = [int(y in OFFICIAL_HOLIDAYS) for y in ymd_list]
    adv["is_religious_holiday"] = [int(y in RELIGIOUS_HOLIDAYS) for y in ymd_list]
    adv["is_holiday_eve"] = [int(y in HOLIDAY_EVES) for y in ymd_list]
    adv["is_school_term"] = [int(_in_ranges(y, DATE_RANGES["school_term"])) for y in ymd_list]
    adv["is_midterm_break"] = [
        int(_in_ranges(y, DATE_RANGES["school_midterm"])) for y in ymd_list
    ]
    adv["is_university_term"] = [
        int(_in_ranges(y, DATE_RANGES["university_term"])) for y in ymd_list
    ]
    adv["is_university_break"] = [
        int(_in_ranges(y, DATE_RANGES["university_break"])) for y in ymd_list
    ]

    durak_ids = base["durakId"].astype(str).to_numpy()
    adv["is_transfer_station"] = [
        int(d in TRANSFER_STATION_IDS) for d in durak_ids
    ]
    adv["station_type_encoded"] = [
        resolve_station_type_encoded(d) for d in durak_ids
    ]

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

    has_ev = np.zeros(n, dtype=np.int32)
    ev_type = np.zeros(n, dtype=np.int32)
    ev_score = np.zeros(n, dtype=np.float32)
    temp = np.zeros(n, dtype=np.float32)
    rain = np.zeros(n, dtype=np.int32)
    snow = np.zeros(n, dtype=np.int32)
    w_score = np.zeros(n, dtype=np.float32)

    for i in range(n):
        ymd = ymd_list[i]
        h = int(hours[i])
        d_id = str(durak_ids[i])
        he, et, es = resolve_event_features(d_id, ymd, h)
        has_ev[i] = he
        ev_type[i] = et
        ev_score[i] = es
        w = resolve_mock_weather(ymd, h)
        temp[i] = float(w["temperature"])
        rain[i] = int(w["rain"])
        snow[i] = int(w["snow"])
        w_score[i] = float(w["weather_impact_score"])

    adv["has_event"] = has_ev
    adv["event_type_encoded"] = ev_type
    adv["event_impact_score"] = ev_score
    adv["temperature"] = temp
    adv["rain"] = rain
    adv["snow"] = snow
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
