"""Hiệu chỉnh khoảng tin cậy của mô hình định giá bằng split conformal.

Chạy (sau khi đã có mô hình từ ``training.train``):
    python -m training.calibrate_interval

VÌ SAO CẦN: khoảng tin cậy trước đây dùng độ rộng ĐẶT TAY (±12 / 20 / 32 % trên thang log)
cho ba mức tin cậy, và chưa ai đo xem "khoảng 80%" đó thực sự chứa giá thật bao nhiêu phần
trăm số lần. Đo ra thì chỉ 40–53%: trang Định giá đang hứa một độ chắc chắn mà mô hình
không có. Độ rộng phải được đo, không được đoán.

PHƯƠNG PHÁP (split conformal, theo từng mức tin cậy):
  1. Tập hiệu chỉnh = tập kiểm định (10% cuối của phần huấn luyện — chỉ dùng để dừng sớm,
     mô hình không học trên nó). Tính phần dư tuyệt đối trên thang log: |log y − log ŷ|.
  2. Với mỗi mức tin cậy, độ rộng = phân vị thứ ⌈(n+1)·0,8⌉/n của phần dư. Định lý
     conformal bảo đảm độ phủ ≥ 80% trên dữ liệu cùng phân phối, không cần giả định phân
     phối sai số.
  3. ĐO LẠI trên tập kiểm tra (15% mới nhất, chưa từng dùng ở bước nào) — đây là con số
     được báo cáo, vì tập kiểm tra mới thật sự mô phỏng tin đăng tương lai.

LƯU Ý: training.train ghi đè avm.report.json — huấn luyện lại thì phải chạy lại script này,
nếu không dịch vụ lùi về độ rộng đặt tay (và /model-info báo interval_coverage_80 = null).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training._console import setup as _console_setup  # noqa: E402

_console_setup()

import joblib  # noqa: E402
import lightgbm as lgb  # noqa: E402

from app.features import build_features, to_categorical  # noqa: E402
from app.predict import _MIN_AREA_SAMPLE, _SPREAD  # noqa: E402
from training.train import time_split  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "prepared.parquet"
MODEL_DIR = ROOT / "models"

COVERAGE = 0.80
FILLED_COLS = ("bedroom_count", "bathroom_count", "floor_count", "frontage_width")


def confidence_bucket(X_raw: pd.DataFrame, area_stats: pd.DataFrame) -> pd.Series:
    """Tái hiện ĐÚNG quy tắc Model._confidence của app/predict.py, nhưng theo vector."""
    n = (
        X_raw[["province", "district"]]
        .merge(area_stats[["province", "district", "n"]], on=["province", "district"], how="left")["n"]
        .fillna(0)
        .to_numpy()
    )
    filled = X_raw[list(FILLED_COLS)].notna().sum(axis=1).to_numpy()
    out = np.where(
        n < _MIN_AREA_SAMPLE,
        "thấp",
        np.where(filled <= 1, "trung bình", np.where(filled < 3, "trung bình", "cao")),
    )
    return pd.Series(out, index=X_raw.index)


def conformal_q(residuals: np.ndarray, coverage: float) -> float:
    n = len(residuals)
    k = min(n, math.ceil((n + 1) * coverage))
    return float(np.sort(residuals)[k - 1])


def main() -> None:
    meta = joblib.load(MODEL_DIR / "avm.meta.joblib")
    booster = lgb.Booster(model_file=str(MODEL_DIR / "avm.txt"))
    area_stats = pd.read_parquet(MODEL_DIR / "avm.area_stats.parquet")

    df = pd.read_parquet(DATA)
    train_df, test_df = time_split(df)
    n_valid = max(1, int(len(train_df) * 0.1))
    calib_df = train_df.iloc[-n_valid:]   # cùng cách cắt với train.py

    def residuals(part: pd.DataFrame) -> tuple[np.ndarray, pd.Series]:
        X_raw = build_features(part)
        X = to_categorical(X_raw, meta["categories"])
        log_pred = booster.predict(X[meta["features"]], num_iteration=meta.get("best_iteration"))
        r = np.abs(np.log(part["price"].to_numpy(dtype="float64")) - log_pred)
        ok = np.isfinite(r)
        return r[ok], confidence_bucket(X_raw, area_stats)[ok]

    r_cal, b_cal = residuals(calib_df)
    r_test, b_test = residuals(test_df)

    report: dict = {"method": "split conformal theo mức tin cậy", "coverage": COVERAGE, "buckets": {}}
    print(f"Tập hiệu chỉnh: {len(r_cal):,} tin · Tập kiểm tra: {len(r_test):,} tin\n")
    print(f"{'Mức':<12}{'n hiệu chỉnh':>14}{'n kiểm tra':>12}"
          f"{'độ phủ cũ (KT)':>16}{'độ rộng mới':>14}{'độ phủ mới (KT)':>17}")

    for bucket in ["cao", "trung bình", "thấp"]:
        rc = r_cal[(b_cal == bucket).to_numpy()]
        rt = r_test[(b_test == bucket).to_numpy()]
        if len(rc) < 200 or len(rt) == 0:
            print(f"{bucket:<12} không đủ dữ liệu ({len(rc)} / {len(rt)}) — giữ độ rộng cũ")
            continue

        old = _SPREAD[bucket]
        old_cov = float((rt <= old).mean())
        q = conformal_q(rc, COVERAGE)
        cov = float((rt <= q).mean())
        report["buckets"][bucket] = {
            "n_calibration": int(len(rc)),
            "n_test": int(len(rt)),
            "old_spread": old,
            "old_coverage_test": round(old_cov, 4),
            "spread_80": round(q, 4),
            "coverage_80_test": round(cov, 4),
        }
        print(f"{bucket:<12}{len(rc):>14,}{len(rt):>12,}{old_cov:>15.1%} "
              f"{q:>13.3f}{cov:>16.1%}")

    path = MODEL_DIR / "avm.report.json"
    full = json.loads(path.read_text(encoding="utf-8"))
    full["interval_calibration"] = report
    path.write_text(json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nĐã ghi kết quả vào {path.name} (khoá interval_calibration).")


if __name__ == "__main__":
    main()
