#!/usr/bin/env python3
"""
Offline training + prediction export. Reads assets/data/passengerData.json,
trains best-of ensemble (RF / XGBoost / LightGBM / GradientBoosting),
writes ml/model.joblib, ml/feature_maps.joblib, ml/model_reports/*,
assets/data/predictions-by-date/*.json, predictionDates.json,
src/generated/predictionDataIndex.ts
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import traceback
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from feature_engineering import (
    FEATURE_NAMES,
    LEGACY_FEATURE_NAMES,
    EventLoader,
    HolidayLoader,
    HistoricalFeatureStore,
    WeatherLoader,
    build_durak_id_num,
    build_feature_array,
    compute_aggregates,
)

try:
    import sys as _sys
    import os as _os
    _sys.path.insert(0, _os.path.dirname(__file__))
    from fetch_weather_forecast import fetch_forecast as _fetch_forecast
    _HAS_FORECAST_MODULE = True
except ImportError:
    _HAS_FORECAST_MODULE = False
    print("Uyarı: fetch_weather_forecast.py bulunamadı — mevsimsel fallback kullanılacak.")

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
REPORTS_DIR = ML_DIR / "model_reports"

PREDICTION_DAYS = 365

# Hızlı debug: örn. 5000 yapın. None = tüm passengerData.json (varsayılan).
DEBUG_SAMPLE_SIZE: int | None = None

BASELINE_MAE = 13.3844
BASELINE_R2 = 0.9690

# "time_based" (varsayılan) | "random_holdout"
SPLIT_MODE = "time_based"
TRAIN_FRACTION = 0.8


def _ymd(ts: pd.Timestamp | datetime | Any) -> str:
    if isinstance(ts, pd.Timestamp):
        return ts.strftime("%Y-%m-%d")
    if isinstance(ts, datetime):
        return ts.strftime("%Y-%m-%d")
    return pd.to_datetime(ts).strftime("%Y-%m-%d")


def _row_dates(df: pd.DataFrame) -> pd.Series:
    return pd.to_datetime(df["tarih"], errors="coerce").dt.normalize()


def _date_overlap_stats(
    train_df: pd.DataFrame, test_df: pd.DataFrame
) -> tuple[int, int, int]:
    train_dates = set(_row_dates(train_df).dropna().unique())
    test_dates = set(_row_dates(test_df).dropna().unique())
    overlap = train_dates & test_dates
    return len(train_dates), len(test_dates), len(overlap)


def split_train_test(
    df: pd.DataFrame,
    mode: str = SPLIT_MODE,
    train_fraction: float = TRAIN_FRACTION,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Eğitim/test ayrımı.

    time_based: benzersiz tarihler kronolojik sıralanır; ilk %80 tarih train, son %20 test.
    Aynı takvim günü yalnızca tek tarafta bulunur (tarih sızıntısı yok).
    """
    if mode not in ("time_based", "random_holdout"):
        print(f"Error: unknown SPLIT_MODE={mode!r}", file=sys.stderr)
        sys.exit(1)

    sorted_df = df.sort_values(["tarih", "durakId", "saat"], kind="mergesort").reset_index(
        drop=True
    )
    n = len(sorted_df)
    if n == 0:
        print("Error: empty dataframe.", file=sys.stderr)
        sys.exit(1)

    if mode == "time_based":
        row_date = _row_dates(sorted_df)
        unique_dates = sorted(row_date.dropna().unique())
        n_unique = len(unique_dates)
        cut_dates = int(n_unique * train_fraction)
        if cut_dates <= 0 or cut_dates >= n_unique:
            print(
                f"Error: invalid train_fraction={train_fraction} for "
                f"{n_unique} unique dates.",
                file=sys.stderr,
            )
            sys.exit(1)

        train_date_set = set(unique_dates[:cut_dates])
        test_date_set = set(unique_dates[cut_dates:])
        train_mask = row_date.isin(train_date_set)
        test_mask = row_date.isin(test_date_set)
        train_df = sorted_df.loc[train_mask].copy()
        test_df = sorted_df.loc[test_mask].copy()

        unique_train_dates = len(train_date_set)
        unique_test_dates = len(test_date_set)
        overlap_date_count = len(train_date_set & test_date_set)

        test_pct = round((1.0 - train_fraction) * 100)
        description = (
            "Model karşılaştırma ve seçim metrikleri, kronolojik benzersiz-tarih "
            f"hold-out test seti (son %{test_pct} takvim günü) üzerinde hesaplanır. "
            "Train ve test tarihleri ayrıktır."
        )
        method = "chronological_unique_date_split"
    else:
        cut = int(n * train_fraction)
        if cut <= 0 or cut >= n:
            print(
                f"Error: invalid train_fraction={train_fraction} for n={n} rows.",
                file=sys.stderr,
            )
            sys.exit(1)
        idx = np.arange(n)
        tr_idx, te_idx = train_test_split(
            idx,
            test_size=1.0 - train_fraction,
            random_state=42,
            shuffle=True,
        )
        train_df = sorted_df.iloc[tr_idx].copy()
        test_df = sorted_df.iloc[te_idx].copy()
        unique_train_dates, unique_test_dates, overlap_date_count = _date_overlap_stats(
            train_df, test_df
        )
        description = (
            "Model karşılaştırma ve seçim metrikleri, rastgele hold-out test seti "
            f"(%{int((1 - train_fraction) * 100)}, shuffle) üzerinde hesaplanır."
        )
        method = "sklearn.model_selection.train_test_split"

    info: dict[str, Any] = {
        "split_mode": mode,
        "train_fraction": train_fraction,
        "test_fraction": round(1.0 - train_fraction, 4),
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
        "unique_train_dates": unique_train_dates,
        "unique_test_dates": unique_test_dates,
        "overlap_date_count": overlap_date_count,
        "train_date_min": _ymd(train_df["tarih"].min()),
        "train_date_max": _ymd(train_df["tarih"].max()),
        "test_date_min": _ymd(test_df["tarih"].min()),
        "test_date_max": _ymd(test_df["tarih"].max()),
        "description": description,
        "method": method,
    }
    if mode == "random_holdout":
        info["random_state"] = 42
        info["shuffle"] = True
    return train_df, test_df, info


def log_split_date_checks(split_info: dict[str, Any]) -> None:
    print(f"unique_train_dates: {split_info['unique_train_dates']}")
    print(f"unique_test_dates: {split_info['unique_test_dates']}")
    print(f"overlap_date_count: {split_info['overlap_date_count']}")
    if split_info["overlap_date_count"] == 0:
        print("No date leakage detected between train and test sets.")
    else:
        print(
            f"WARNING: {split_info['overlap_date_count']} tarih hem train hem testte!",
            file=sys.stderr,
        )


def evaluation_console_message(split_info: dict[str, Any]) -> str:
    mode = split_info["split_mode"]
    if mode == "time_based":
        return (
            "Evaluation split: time_based — model geçmiş tarihlerle eğitilip "
            "sonraki tarihlerde test edilmiştir."
        )
    return (
        "Evaluation split: random_holdout — model rastgele ayrılmış "
        "test setinde değerlendirilmiştir."
    )


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


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true != 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": mape(y_true, y_pred),
        "r2": float(r2_score(y_true, y_pred)),
    }


def station_level_metrics(
    test_df: pd.DataFrame,
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    tmp = test_df.copy()
    tmp["_y"] = y_true
    tmp["_p"] = y_pred
    for durak_id, grp in tmp.groupby("durakId", observed=True):
        yt = grp["_y"].to_numpy()
        yp = grp["_p"].to_numpy()
        m = evaluate_predictions(yt, yp)
        name = str(grp["durakAd"].iloc[0]) if "durakAd" in grp.columns else ""
        rows.append(
            {
                "durakId": str(durak_id),
                "durakAd": name,
                "rowCount": int(len(grp)),
                **m,
            }
        )
    rows.sort(key=lambda r: r["mae"], reverse=True)
    return rows


def extract_feature_importance(model: Any, feature_names: list[str]) -> list[dict[str, Any]]:
    imp = getattr(model, "feature_importances_", None)
    if imp is None:
        return []
    pairs = sorted(
        zip(feature_names, [float(x) for x in imp]),
        key=lambda x: x[1],
        reverse=True,
    )
    return [{"feature": n, "importance": v} for n, v in pairs]


def get_candidate_models() -> list[tuple[str, Any]]:
    candidates: list[tuple[str, Any]] = [
        (
            "RandomForest",
            RandomForestRegressor(
                n_estimators=120,
                max_depth=24,
                min_samples_split=4,
                min_samples_leaf=2,
                max_features="sqrt",
                random_state=42,
                n_jobs=-1,
            ),
        ),
        (
            "GradientBoosting",
            GradientBoostingRegressor(
                n_estimators=150,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.85,
                random_state=42,
            ),
        ),
    ]
    try:
        from xgboost import XGBRegressor

        candidates.append(
            (
                "XGBoost",
                XGBRegressor(
                    n_estimators=200,
                    max_depth=8,
                    learning_rate=0.08,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    random_state=42,
                    n_jobs=-1,
                    objective="reg:squarederror",
                ),
            )
        )
    except ImportError:
        print("XGBoost yüklü değil — atlanıyor (pip install xgboost).")

    try:
        from lightgbm import LGBMRegressor

        candidates.append(
            (
                "LightGBM",
                LGBMRegressor(
                    n_estimators=200,
                    max_depth=-1,
                    num_leaves=63,
                    learning_rate=0.08,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    random_state=42,
                    n_jobs=-1,
                    verbose=-1,
                ),
            )
        )
    except ImportError:
        print("LightGBM yüklü değil — atlanıyor (pip install lightgbm).")

    return candidates


def train_and_select_best(
    X_tr: np.ndarray,
    y_tr: np.ndarray,
    X_te: np.ndarray,
    y_te: np.ndarray,
    split_info: dict[str, Any],
) -> tuple[str, Any, dict[str, float], list[dict[str, Any]]]:
    print("\n=== Model karşılaştırma ===")
    print(evaluation_console_message(split_info))
    print(split_info["description"])
    print(f"  split_mode: {split_info['split_mode']}")
    print(f"  X_train: {X_tr.shape}  y_train: ({len(y_tr)},)")
    print(f"  X_test:  {X_te.shape}  y_test:  ({len(y_te)},)")
    comparison: list[dict[str, Any]] = []
    eval_label = f"{split_info['split_mode']}_test_set"
    best_name = ""
    best_model: Any = None
    best_mae = float("inf")
    best_metrics: dict[str, float] = {}

    for name, model in get_candidate_models():
        print(f"\n--- Eğitim: {name} ---")
        try:
            model.fit(X_tr, y_tr)
            y_pred = model.predict(X_te)
            metrics = evaluate_predictions(y_te, y_pred)
            importance = extract_feature_importance(model, FEATURE_NAMES)
            row = {
                "model": name,
                "split_mode": split_info["split_mode"],
                "evaluated_on": eval_label,
                "test_rows": int(len(y_te)),
                "test_date_min": split_info["test_date_min"],
                "test_date_max": split_info["test_date_max"],
                **metrics,
                "feature_importance_top5": importance[:5],
            }
            comparison.append(row)
            print(
                f"  MAE={metrics['mae']:.4f} RMSE={metrics['rmse']:.4f} "
                f"MAPE={metrics['mape']:.2f}% R2={metrics['r2']:.4f}"
            )
            if metrics["mae"] < best_mae:
                best_mae = metrics["mae"]
                best_name = name
                best_model = model
                best_metrics = metrics
        except Exception as exc:
            print(f"  {name} başarısız: {exc}", file=sys.stderr)
            traceback.print_exc()

    if best_model is None:
        print("Error: hiçbir model eğitilemedi.", file=sys.stderr)
        sys.exit(1)

    print(f"\n>>> Seçilen model: {best_name} (MAE={best_mae:.4f})")
    return best_name, best_model, best_metrics, comparison


def write_reports(
    *,
    best_model_name: str,
    overall_metrics: dict[str, float],
    comparison: list[dict[str, Any]],
    station_metrics: list[dict[str, Any]],
    feature_importance: list[dict[str, Any]],
    total_rows: int,
    split_info: dict[str, Any],
    debug_sample_size: int | None,
    x_train_shape: tuple[int, ...],
    x_test_shape: tuple[int, ...],
) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    summary = {
        "best_model": best_model_name,
        "total_rows": total_rows,
        "split_mode": split_info["split_mode"],
        "train_rows": split_info["train_rows"],
        "test_rows": split_info["test_rows"],
        "train_date_min": split_info["train_date_min"],
        "train_date_max": split_info["train_date_max"],
        "test_date_min": split_info["test_date_min"],
        "test_date_max": split_info["test_date_max"],
        "unique_train_dates": split_info["unique_train_dates"],
        "unique_test_dates": split_info["unique_test_dates"],
        "overlap_date_count": split_info["overlap_date_count"],
        "no_date_leakage": split_info["overlap_date_count"] == 0,
        "feature_count": len(FEATURE_NAMES),
        "legacy_feature_count": len(LEGACY_FEATURE_NAMES),
        "debug_sample_size": debug_sample_size,
        "x_train_shape": list(x_train_shape),
        "x_test_shape": list(x_test_shape),
        "evaluation_split": split_info,
        "metrics": overall_metrics,
        "metrics_evaluated_on": f"{split_info['split_mode']}_test_set",
        "baseline_reference": {"mae": BASELINE_MAE, "r2": BASELINE_R2},
    }
    (REPORTS_DIR / "training_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    comparison_doc = {
        "evaluation_split": split_info,
        "note": evaluation_console_message(split_info),
        "models": comparison,
    }
    (REPORTS_DIR / "model_comparison.json").write_text(
        json.dumps(comparison_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (REPORTS_DIR / "station_performance.json").write_text(
        json.dumps(station_metrics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (REPORTS_DIR / "feature_importance.json").write_text(
        json.dumps(feature_importance, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if not PASSENGER_JSON.is_file():
        print(f"Error: missing {PASSENGER_JSON}", file=sys.stderr)
        sys.exit(1)
    if not STATIONS_JSON.is_file():
        print(f"Error: missing {STATIONS_JSON}", file=sys.stderr)
        sys.exit(1)

    df = load_passenger_data()
    loaded_rows = len(df)

    if DEBUG_SAMPLE_SIZE is not None and DEBUG_SAMPLE_SIZE > 0:
        n = min(DEBUG_SAMPLE_SIZE, loaded_rows)
        print(
            f"\n*** DEBUG MODU: DEBUG_SAMPLE_SIZE={DEBUG_SAMPLE_SIZE} — "
            f"yalnızca {n}/{loaded_rows} satır kullanılıyor ***\n",
            file=sys.stderr,
        )
        df = df.sample(n=n, random_state=42).reset_index(drop=True)

    total_rows = len(df)
    id_map = build_durak_id_num(df)

    train_df, test_df, split_info = split_train_test(df, mode=SPLIT_MODE)

    g_mean = float(train_df["yolcuSayisi"].mean())
    tr_aggs = compute_aggregates(train_df)
    hist_train = HistoricalFeatureStore.from_dataframe(train_df, g_mean)
    hist_full = HistoricalFeatureStore.from_dataframe(df, float(df["yolcuSayisi"].mean()))

    X_tr = build_feature_array(train_df, id_map, tr_aggs, g_mean, hist_train)
    X_te = build_feature_array(test_df, id_map, tr_aggs, g_mean, hist_train)
    y_tr = train_df["yolcuSayisi"].to_numpy()
    y_te = test_df["yolcuSayisi"].to_numpy()

    n_train = int(len(y_tr))
    n_test = int(len(y_te))
    feature_count = len(FEATURE_NAMES)

    print("\n=== Veri özeti ===")
    if DEBUG_SAMPLE_SIZE is None:
        print(f"Mod: tam veri (DEBUG_SAMPLE_SIZE=None, yüklü satır={loaded_rows})")
    else:
        print(f"Mod: debug örneklem (DEBUG_SAMPLE_SIZE={DEBUG_SAMPLE_SIZE})")
    print(evaluation_console_message(split_info))
    print(f"split_mode: {split_info['split_mode']}")
    print(f"total_rows: {total_rows}")
    print(f"train_rows: {n_train}")
    print(f"test_rows: {n_test}")
    print(f"train_date_min: {split_info['train_date_min']}")
    print(f"train_date_max: {split_info['train_date_max']}")
    print(f"test_date_min: {split_info['test_date_min']}")
    print(f"test_date_max: {split_info['test_date_max']}")
    log_split_date_checks(split_info)
    print(f"feature_count: {feature_count} (legacy={len(LEGACY_FEATURE_NAMES)})")
    print(f"X_train shape: {X_tr.shape}")
    print(f"X_test shape: {X_te.shape}")

    best_name, model, metrics, comparison = train_and_select_best(
        X_tr, y_tr, X_te, y_te, split_info
    )
    y_pred = model.predict(X_te)

    print("\n=== Seçilen model — test seti metrikleri ===")
    print(evaluation_console_message(split_info))
    print(split_info["description"])
    print(f"test_rows: {n_test}  X_test shape: {X_te.shape}")
    print(f"MAE: {metrics['mae']:.4f}")
    print(f"RMSE: {metrics['rmse']:.4f}")
    print(f"MAPE: {metrics['mape']:.2f}%")
    print(f"R2: {metrics['r2']:.4f}")
    print("---")
    print(
        f"Referans (eski) MAE: {BASELINE_MAE:.4f}  →  yeni MAE: {metrics['mae']:.4f}  "
        f"(Δ: {metrics['mae'] - BASELINE_MAE:+.4f})"
    )
    print(
        f"Referans (eski) R2: {BASELINE_R2:.4f}  →  yeni R2: {metrics['r2']:.4f}  "
        f"(Δ: {metrics['r2'] - BASELINE_R2:+.4f})"
    )

    station_metrics = station_level_metrics(test_df, y_te, y_pred)
    importance = extract_feature_importance(model, FEATURE_NAMES)
    write_reports(
        best_model_name=best_name,
        overall_metrics=metrics,
        comparison=comparison,
        station_metrics=station_metrics,
        feature_importance=importance,
        total_rows=total_rows,
        split_info=split_info,
        debug_sample_size=DEBUG_SAMPLE_SIZE,
        x_train_shape=tuple(X_tr.shape),
        x_test_shape=tuple(X_te.shape),
    )
    print(f"Raporlar: {REPORTS_DIR.relative_to(ROOT)}")

    full_mean = float(df["yolcuSayisi"].mean())
    full_aggs = compute_aggregates(df)
    feature_maps: dict[str, Any] = {
        "durak_id_to_num": id_map,
        "aggregates": full_aggs,
        "global_mean": full_mean,
        "feature_names": FEATURE_NAMES,
        "legacy_feature_names": LEGACY_FEATURE_NAMES,
        "best_model_name": best_name,
        "training_metrics": metrics,
        "split_mode": SPLIT_MODE,
        "evaluation_split": split_info,
    }
    st_raw: list[dict[str, Any]] = json.loads(STATIONS_JSON.read_text(encoding="utf-8"))
    feature_maps["station_order"] = [
        str(s["durakId"]) for s in sorted(st_raw, key=lambda x: str(x["durakId"]))
    ]

    ML_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH, compress=3)
    joblib.dump(feature_maps, MAPS_PATH)
    model_size_mb = os.path.getsize(MODEL_PATH) / 1024 / 1024
    print("Model size (MB):", round(model_size_mb, 2))
    if model_size_mb >= 200:
        print(
            f"Uyarı: model hâlâ {model_size_mb:.1f} MB (hedef < 200 MB).",
            file=sys.stderr,
        )

    with open(STATIONS_JSON, "r", encoding="utf-8") as f:
        stations: list[dict[str, Any]] = json.load(f)
    if len(stations) != 75:
        print(f"Warning: expected 75 stations, got {len(stations)}. Proceeding with file list.")

    # ── Open-Meteo forecast yükle (2026 tahminleri için) ─────────────────────
    if _HAS_FORECAST_MODULE:
        forecast_data = _fetch_forecast()
        WeatherLoader.set_forecast(forecast_data)
    else:
        print("[forecast] Modül yok — mevsimsel ortalama kullanılacak.")

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
    h_range = list(range(5, 24))

    # ── Tahmin zenginleştirme önbellekleri ────────────────────────────────────
    _w_cache: dict[tuple[str, int], dict[str, float]] = {}
    _h_cache: dict[str, dict[str, Any]] = {}

    def _get_weather(ds: str, hr: int) -> dict[str, float]:
        k = (ds, hr)
        if k not in _w_cache:
            _w_cache[k] = WeatherLoader.get_weather(ds, hr)
        return _w_cache[k]

    def _get_holiday(ds: str) -> dict[str, Any]:
        if ds not in _h_cache:
            _h_cache[ds] = HolidayLoader.get_holiday_info(ds)
        return _h_cache[ds]

    def _compute_main_factors(
        hr: int,
        is_wknd: int,
        hol: dict[str, Any],
        ev: dict[str, Any],
        w: dict[str, float],
    ) -> list[str]:
        factors: list[str] = []
        if 7 <= hr <= 9:
            factors.append("Sabah yoğunluğu")
        elif 17 <= hr <= 19:
            factors.append("Mesai çıkışı")
        if w.get("snowfall", 0.0) > 0.5:
            factors.append("Kar yağışı")
        elif w.get("precipitation", 0.0) > 2.0:
            factors.append("Yağış")
        elif w.get("windSpeed", 0.0) > 25.0:
            factors.append("Güçlü rüzgar")
        if hol.get("is_official_holiday"):
            if hol.get("is_religious_holiday"):
                factors.append("Dini bayram")
            elif hol.get("is_national_holiday"):
                factors.append("Millî tatil")
            else:
                factors.append("Resmî tatil")
        elif hol.get("is_holiday_eve"):
            factors.append("Bayram arifesi")
        if ev.get("is_match_day"):
            factors.append("Maç günü")
        elif ev.get("is_exam_week"):
            factors.append("Sınav haftası")
        elif ev.get("is_event_day"):
            factors.append("Etkinlik günü")
        if is_wknd and not factors:
            factors.append("Hafta sonu")
        return factors[:3]

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
    Xp = build_feature_array(p_feat, id_map, full_aggs, full_mean, hist_full)
    y_hat = model.predict(Xp)
    for i in range(len(p_df)):
        d_str = str(d_list[i])
        h = int(p_df["saat"].iloc[i])
        did = str(p_df["durakId"].iloc[i])
        name = str(p_df["durakAd"].iloc[i])
        pr = y_hat[i]
        pc = int(max(0, round(float(pr))))

        w = _get_weather(d_str, h)
        w_score = WeatherLoader.compute_impact_score(w)
        w_level = WeatherLoader.compute_impact_level(w_score)
        hol = _get_holiday(d_str)
        ev = EventLoader.get_event_features(did, d_str, h)
        is_wknd = int(datetime.strptime(d_str, "%Y-%m-%d").weekday() >= 5)
        factors = _compute_main_factors(h, is_wknd, hol, ev, w)

        by_day[d_str].append(
            {
                "durakId": did,
                "durakAd": name,
                "date": d_str,
                "hour": h,
                "predictedPassengerCount": pc,
                "weatherImpactScore": round(w_score, 2),
                "weatherImpactLevel": w_level,
                "mainFactors": factors,
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
