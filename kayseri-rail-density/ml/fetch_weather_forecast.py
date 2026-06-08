#!/usr/bin/env python3
"""
Open-Meteo 16 günlük saatlik tahmin çekici — Kayseri.

İçe aktarılabilir modül olarak kullanımı:
    from fetch_weather_forecast import fetch_forecast
    forecast = fetch_forecast()   # {(date_str, hour): {temperature, ...}}
    WeatherLoader.set_forecast(forecast)

Bağımsız çalıştırma (stdout'a JSON yazar):
    python fetch_weather_forecast.py
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

KAYSERI_LAT = 38.7333
KAYSERI_LON = 35.4833
FORECAST_DAYS = 16  # Open-Meteo ücretsiz plan maksimumu

_API_URL = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={KAYSERI_LAT}"
    f"&longitude={KAYSERI_LON}"
    "&hourly=temperature_2m,precipitation,rain,snowfall,"
    "windspeed_10m,windgusts_10m,winddirection_10m"
    f"&forecast_days={FORECAST_DAYS}"
    "&timezone=Europe%2FIstanbul"
)

_COL_MAP = {
    "temperature": "temperature_2m",
    "precipitation": "precipitation",
    "rain": "rain",
    "snowfall": "snowfall",
    "windSpeed": "windspeed_10m",
    "windGusts": "windgusts_10m",
    "windDirection": "winddirection_10m",
}


def fetch_forecast() -> dict[tuple[str, int], dict[str, float]]:
    """
    Open-Meteo API'sinden 16 günlük saatlik tahmin çeker.

    Dönüş değeri: {(date_str, hour): {temperature, precipitation, rain, snowfall,
                                       windSpeed, windGusts, windDirection}}

    Ağ hatası veya API hatası durumunda boş dict döner;
    çağıran kod mevsimsel ortalama fallback kullanmalıdır.
    """
    print(f"[forecast] Open-Meteo API çağrılıyor ({FORECAST_DAYS} günlük tahmin)...")
    try:
        req = urllib.request.Request(
            _API_URL,
            headers={"User-Agent": "kayseri-rail-density/1.0"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
        data: dict = json.loads(raw)
    except urllib.error.URLError as exc:
        print(f"[forecast] Ağ hatası: {exc} — mevsimsel ortalama kullanılacak.", file=sys.stderr)
        return {}
    except Exception as exc:
        print(f"[forecast] Beklenmeyen hata: {exc} — mevsimsel ortalama kullanılacak.", file=sys.stderr)
        return {}

    hourly = data.get("hourly", {})
    times: list[str] = hourly.get("time", [])
    if not times:
        print("[forecast] API yanıtı boş — mevsimsel ortalama kullanılacak.", file=sys.stderr)
        return {}

    result: dict[tuple[str, int], dict[str, float]] = {}
    for i, dt_str in enumerate(times):
        # dt_str örn: "2026-05-21T14:00"
        date_str = dt_str[:10]
        hour = int(dt_str[11:13])
        vals: dict[str, float] = {}
        for col, api_key in _COL_MAP.items():
            col_data = hourly.get(api_key, [])
            raw_val = col_data[i] if i < len(col_data) else None
            vals[col] = float(raw_val) if raw_val is not None else 0.0
        result[(date_str, hour)] = vals

    n = len(result)
    print(f"[forecast] {n} saatlik tahmin alındı ({n // 24} gün, {times[0][:10]} – {times[-1][:10]}).")
    return result


def main() -> None:
    """Bağımsız çalıştırma: forecast verisini stdout'a JSON olarak yazar."""
    forecast = fetch_forecast()
    if not forecast:
        print("Tahmin verisi alınamadı.", file=sys.stderr)
        sys.exit(1)
    out = [
        {"date": k[0], "hour": k[1], **v}
        for k, v in sorted(forecast.items())
    ]
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
