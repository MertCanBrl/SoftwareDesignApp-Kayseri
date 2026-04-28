#!/usr/bin/env python3
"""
Offline training + prediction export. Reads assets/data/passengerData.json,
trains RandomForestRegressor, writes ml/model.joblib, ml/feature_maps.joblib,
assets/data/predictions-by-date/*.json, predictionDates.json,
src/generated/predictionDataIndex.ts
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "data"
PASSENGER_JSON = ASSETS / "passengerData.json"
STATIONS_JSON = ASSETS / "stations.json"
PRED_DIR = ASSETS / "predictions-by-date"
PRED_DATES_FILE = ASSETS / "predictionDates.json"
PRED_INDEX = ROOT / "src" / "generated" / "predictionDataIndex.ts"
ML_DIR = ROOT / "ml"
MODEL_PATH = ML_DIR / "model.joblib"
MAPS_PATH = ML_DIR / "feature_maps.joblib"

PREDICTION_DAYS = 365

# Referans: önceki ağaçsız, büyük model (n_estimators=150, max_depth=None) tek koşu
BASELINE_MAE = 13.3844
BASELINE_R2 = 0.9690

FEATURE_NAMES = [
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


def load_passenger_data() -> pd.DataFrame:
    with open(PASSENGER_JSON, "r", encoding="utf-8") as f:
        raw: Any = json.load(f)
    if not isinstance(raw, list) or not raw:
        print("Error: passengerData.json must be a non-empty array.", file=sys.stderr)
        sys.exit(1)
    df = pd.DataFrame(raw)
    for col in ("tarih", "durakId", "durakAd", "saat", "yolcuSayisi"):
        if col not in df.columns:
            print(f"Error: missing column: {col}", file=sys.stderr)
            sys.exit(1)
    df = df.copy()
    df["tarih"] = pd.to_datetime(df["tarih"], errors="coerce")
    df = df[df["tarih"].notna()]
    if df.empty:
        print("Error: no valid rows after date parse.", file=sys.stderr)
        sys.exit(1)
    df["durakId"] = df["durakId"].astype(str)
    return df


def build_durak_id_num(df: pd.DataFrame) -> dict[str, int]:
    all_ids = sorted(
        {str(x) for x in df["durakId"]},
        key=lambda s: int(s) if s.isdigit() else 0,
    )
    return {sid: i for i, sid in enumerate(all_ids)}


def add_calendar_features(t: pd.Series) -> pd.DataFrame:
    p = t.dt
    d = {
        "day": p.day.astype(np.int32),
        "month": p.month.astype(np.int32),
        "day_of_week": p.dayofweek.astype(np.int32),
    }
    d["is_weekend"] = (d["day_of_week"] >= 5).astype(np.int32)
    return pd.DataFrame(d, index=t.index)


def compute_aggregates(f: pd.DataFrame) -> dict[str, Any]:
    station_avg = f.groupby("durakId", observed=True)["yolcuSayisi"].mean()
    sh = f.groupby(["durakId", "saat"], observed=True)["yolcuSayisi"].mean()
    hour_avg = f.groupby("saat", observed=True)["yolcuSayisi"].mean()
    f2 = f.copy()
    f2["_dow"] = f2["tarih"].dt.dayofweek
    dow_h = f2.groupby(["_dow", "saat"], observed=True)["yolcuSayisi"].mean()
    return {
        "station_avg": {str(k): float(v) for k, v in station_avg.to_dict().items()},
        "station_hour": {
            (str(a), int(b)): float(c) for (a, b), c in sh.items()
        },
        "hour": {int(h): float(v) for h, v in hour_avg.items()},
        "dow_hour": {
            (int(a), int(b)): float(c) for (a, b), c in dow_h.items()
        },
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
        sh.get((str(ri), int(s)), np.nan)
        for ri, s in zip(out["durakId"], out["saat"])
    ]
    hmap = aggs["hour"]
    out["hour_avg"] = out["saat"].map(lambda s: hmap.get(int(s), np.nan))
    dhm = aggs["dow_hour"]
    out["day_of_week_hour_avg"] = [
        dhm.get((int(dow), int(s)), np.nan) for dow, s in zip(dows, out["saat"])
    ]
    for c in (
        "station_avg",
        "station_hour_avg",
        "hour_avg",
        "day_of_week_hour_avg",
    ):
        out[c] = out[c].astype(float)
        out[c] = out[c].fillna(global_mean)
    return out


def _build_feature_array(
    f: pd.DataFrame,
    durak_to_num: dict[str, int],
    aggs: dict[str, Any],
    global_mean: float,
) -> np.ndarray:
    base = f.reset_index(drop=True)
    cal = add_calendar_features(base["tarih"])
    dfn = pd.concat([base, cal], axis=1)
    dfn["durak_id_num"] = base["durakId"].astype(str).map(
        lambda s: durak_to_num.get(s, 0)
    )
    extra = _apply_aggregates_vec(base, aggs, global_mean)
    for c in (
        "station_avg",
        "station_hour_avg",
        "hour_avg",
        "day_of_week_hour_avg",
    ):
        dfn[c] = extra[c].values
    return dfn[FEATURE_NAMES].to_numpy(dtype=np.float32)


def main() -> None:
    if not PASSENGER_JSON.is_file():
        print(f"Error: missing {PASSENGER_JSON}", file=sys.stderr)
        sys.exit(1)
    if not STATIONS_JSON.is_file():
        print(f"Error: missing {STATIONS_JSON}", file=sys.stderr)
        sys.exit(1)

    df = load_passenger_data()
    total_rows = len(df)
    id_map = build_durak_id_num(df)

    idx = np.arange(total_rows)
    tr_idx, te_idx = train_test_split(
        idx, test_size=0.2, random_state=42, shuffle=True
    )
    train_df = df.iloc[tr_idx].copy()
    test_df = df.iloc[te_idx].copy()

    g_mean = float(train_df["yolcuSayisi"].mean())
    tr_aggs = compute_aggregates(train_df)
    X_tr = _build_feature_array(train_df, id_map, tr_aggs, g_mean)
    X_te = _build_feature_array(test_df, id_map, tr_aggs, g_mean)
    y_tr = train_df["yolcuSayisi"].to_numpy()
    y_te = test_df["yolcuSayisi"].to_numpy()

    n_train = int(len(y_tr))
    n_test = int(len(y_te))

    model = RandomForestRegressor(
        n_estimators=80,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_tr, y_tr)
    y_pred = model.predict(X_te)
    mae = mean_absolute_error(y_te, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_te, y_pred)))
    r2 = r2_score(y_te, y_pred)

    print(f"Toplam satır sayısı: {total_rows}")
    print(f"Train satır sayısı: {n_train}")
    print(f"Test satır sayısı: {n_test}")
    print(f"MAE: {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R2: {r2:.4f}")
    print("---")
    print(f"Referans (eski, büyük model) MAE: {BASELINE_MAE:.4f}  →  yeni MAE: {mae:.4f}  (Δ: {mae - BASELINE_MAE:+.4f})")
    print(f"Referans (eski) R2: {BASELINE_R2:.4f}  →  yeni R2: {r2:.4f}  (Δ: {r2 - BASELINE_R2:+.4f})")

    full_mean = float(df["yolcuSayisi"].mean())
    full_aggs = compute_aggregates(df)
    feature_maps: dict[str, Any] = {
        "durak_id_to_num": id_map,
        "aggregates": full_aggs,
        "global_mean": full_mean,
        "feature_names": FEATURE_NAMES,
    }
    st_raw: list[dict[str, Any]] = json.loads(
        STATIONS_JSON.read_text(encoding="utf-8")
    )
    feature_maps["station_order"] = [str(s["durakId"]) for s in sorted(st_raw, key=lambda x: str(x["durakId"]))]

    ML_DIR.mkdir(parents=True, exist_ok=True)
    # compress: disk boyutunu ciddi düşürür (RAM’de model aynı)
    joblib.dump(model, MODEL_PATH, compress=3)
    joblib.dump(feature_maps, MAPS_PATH)
    model_size_mb = os.path.getsize(MODEL_PATH) / 1024 / 1024
    print("Model size (MB):", model_size_mb)
    if model_size_mb >= 200:
        print(
            f"Uyarı: model hâlâ {model_size_mb:.1f} MB (hedef < 200 MB). n_estimators / max_depth azaltılabilir.",
            file=sys.stderr,
        )

    with open(STATIONS_JSON, "r", encoding="utf-8") as f:
        stations: list[dict[str, Any]] = json.load(f)
    if len(stations) != 75:
        print(
            f"Warning: expected 75 stations, got {len(stations)}. Proceeding with file list."
        )
    today = datetime.today().date()
    prediction_start = today
    prediction_days = PREDICTION_DAYS
    pred_dates: list[date] = [
        prediction_start + timedelta(days=i) for i in range(prediction_days)
    ]
    prediction_end = pred_dates[-1]
    print(f"prediction_start: {prediction_start.isoformat()}")
    print(f"prediction_end: {prediction_end.isoformat()}")
    print(f"prediction_days: {prediction_days}")

    if PRED_DIR.exists():
        shutil.rmtree(PRED_DIR)
    PRED_DIR.mkdir(parents=True, exist_ok=True)

    by_day: dict[str, list[dict[str, Any]]] = {d.isoformat(): [] for d in pred_dates}
    # Saat 5–23 (range üst sınırı 24)
    h_range = list(range(5, 24))

    build_rows: list[dict[str, Any]] = []
    for d in pred_dates:
        d_str = d.isoformat()
        ts = pd.Timestamp(d)
        for st in sorted(stations, key=lambda x: str(x["durakId"])):
            did = str(st.get("durakId", ""))
            name = str(st.get("name") or st.get("durakAd") or "")
            for h in h_range:
                build_rows.append(
                    {
                        "tarih": ts,
                        "durakId": did,
                        "durakAd": name,
                        "saat": h,
                        "d_str": d_str,
                    }
                )
    p_df = pd.DataFrame(build_rows)
    d_list = p_df["d_str"].to_numpy()
    p_feat = p_df.drop(columns=["d_str"], errors="ignore")
    Xp = _build_feature_array(p_feat, id_map, full_aggs, full_mean)
    y_hat = model.predict(Xp)
    for i in range(len(p_df)):
        d_str = str(d_list[i])
        h = int(p_df["saat"].iloc[i])
        did = str(p_df["durakId"].iloc[i])
        name = str(p_df["durakAd"].iloc[i])
        pr = y_hat[i]
        pc = int(max(0, round(float(pr))))
        by_day[d_str].append(
            {
                "durakId": did,
                "durakAd": name,
                "date": d_str,
                "hour": h,
                "predictedPassengerCount": pc,
            }
        )

    for d_str, rows in by_day.items():
        out_p = PRED_DIR / f"{d_str}.json"
        with open(out_p, "w", encoding="utf-8") as jf:
            json.dump(rows, jf, ensure_ascii=False, indent=2)
            jf.write("\n")

    date_list = [d.isoformat() for d in pred_dates]
    PRED_DATES_FILE.write_text(
        json.dumps(date_list, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    PRED_INDEX.parent.mkdir(parents=True, exist_ok=True)
    index_lines: list[str] = [
        "/** Auto-generated by ml/train_model.py. Do not edit. */",
        "import type { PredictionFileRow } from '../types';",
        "",
        "type Loader = () => PredictionFileRow[];",
        "",
        "export const predictionDataLoaders: Record<string, Loader> = {",
    ]
    for ds in date_list:
        index_lines.append(
            f"  '{ds}': () => require('../../assets/data/predictions-by-date/{ds}.json') as PredictionFileRow[],"
        )
    index_lines.append("};")
    index_lines.append("")
    PRED_INDEX.write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(date_list)} prediction shards to {PRED_DIR.relative_to(ROOT)}")
    if len(date_list) != prediction_days:
        print(
            f"Warning: expected {prediction_days} shards, got {len(date_list)}.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
