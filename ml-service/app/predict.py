"""Nạp mô hình và sinh dự đoán.

Điểm cần cẩn thận nhất ở đây là KHOẢNG TIN CẬY. Một con số trần trụi "căn này 4,2 tỷ" là
thứ nguy hiểm: người đọc mặc định coi nó chính xác tới từng đồng, trong khi mô hình có sai
số trung vị cỡ chục phần trăm. Trả về kèm khoảng và kèm mức tin cậy là cách nói thật về
những gì mô hình biết và không biết — và cũng là chuẩn mực của các nền tảng định giá thật.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .features import prediction_input, to_categorical
from .normalize import norm_district, norm_province

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"

# Nhân tử khoảng tin cậy, suy từ MdAPE đo được trên tập kiểm tra. Ba mức ứng với lượng
# thông tin người dùng khai: khai càng đủ, mô hình càng ít phải đoán.
_SPREAD = {
    "cao": 0.12,
    "trung bình": 0.20,
    "thấp": 0.32,
}

# Dưới ngưỡng này thì khu vực có quá ít tin trong dữ liệu huấn luyện để mô hình học được
# mặt bằng giá của nó.
_MIN_AREA_SAMPLE = 30


@dataclass
class Loaded:
    booster: Any
    meta: dict
    report: dict
    area_stats: pd.DataFrame | None


class Model:
    """Bọc mô hình đã huấn luyện. Nạp một lần lúc khởi động, dùng lại cho mọi request."""

    def __init__(self, name: str = "avm") -> None:
        self.name = name
        self._loaded: Loaded | None = None

    # ---------- Nạp ----------

    def load(self) -> bool:
        model_path = MODEL_DIR / f"{self.name}.txt"
        meta_path = MODEL_DIR / f"{self.name}.meta.joblib"

        if not model_path.exists() or not meta_path.exists():
            return False

        import lightgbm as lgb

        report_path = MODEL_DIR / f"{self.name}.report.json"
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}

        stats_path = MODEL_DIR / f"{self.name}.area_stats.parquet"
        area_stats = pd.read_parquet(stats_path) if stats_path.exists() else None

        self._loaded = Loaded(
            booster=lgb.Booster(model_file=str(model_path)),
            meta=joblib.load(meta_path),
            report=report,
            area_stats=area_stats,
        )
        return True

    @property
    def ready(self) -> bool:
        return self._loaded is not None

    @property
    def report(self) -> dict:
        return self._loaded.report if self._loaded else {}

    # ---------- Dự đoán ----------

    def predict(self, payload: dict) -> dict:
        if self._loaded is None:
            raise RuntimeError("Mô hình chưa được nạp.")

        L = self._loaded
        X = prediction_input(payload)

        # Ép về đúng tập hạng mục đã dùng lúc huấn luyện. Bỏ bước này thì mã hạng mục lệch
        # và mô hình vẫn trả về một con số — chỉ là con số của một quận khác.
        X = to_categorical(X, L.meta["categories"])

        log_price = float(
            L.booster.predict(X[L.meta["features"]], num_iteration=L.meta.get("best_iteration"))[0]
        )
        price = math.exp(log_price)

        area_ppm2, area_n = self._area_stats(payload)
        confidence, notes = self._confidence(payload, area_n)
        spread = _SPREAD[confidence]

        # Khoảng tính trên thang log rồi đổi ngược, nên nó bất đối xứng quanh giá trị dự
        # đoán — đúng với thực tế: giá không thể âm, và phần đuôi trên dài hơn phần dưới.
        low = math.exp(log_price - spread)
        high = math.exp(log_price + spread)

        return {
            "price": _round_vnd(price),
            "price_low": _round_vnd(low),
            "price_high": _round_vnd(high),
            "price_per_m2": _round_vnd(price / max(payload["area"], 1)),
            "confidence": confidence,
            "area_median_price_per_m2": _round_vnd(area_ppm2) if area_ppm2 else None,
            "area_sample_size": area_n,
            "notes": notes,
        }

    # ---------- Nội bộ ----------

    def _area_stats(self, payload: dict) -> tuple[float | None, int]:
        L = self._loaded
        if L is None or L.area_stats is None:
            return None, 0

        key_p = norm_province(payload.get("province"))
        key_d = norm_district(payload.get("district"))

        hit = L.area_stats[
            (L.area_stats["province"] == key_p) & (L.area_stats["district"] == key_d)
        ]
        if hit.empty:
            return None, 0

        row = hit.iloc[0]
        return float(row["median_ppm2"]), int(row["n"])

    def _confidence(self, payload: dict, area_n: int) -> tuple[str, list[str]]:
        """Mức tin cậy dựa trên hai thứ: khu vực có đủ dữ liệu không, và người dùng khai đủ chưa."""
        notes: list[str] = []

        filled = sum(
            1
            for k in ("bedroom_count", "bathroom_count", "floor_count", "frontage_width")
            if payload.get(k) is not None
        )

        if area_n == 0:
            notes.append(
                "Khu vực này chưa từng xuất hiện trong dữ liệu huấn luyện — con số chỉ mang "
                "tính tham khảo rất thô."
            )
            return "thấp", notes

        if area_n < _MIN_AREA_SAMPLE:
            notes.append(
                f"Khu vực này chỉ có {area_n} tin trong dữ liệu huấn luyện, chưa đủ để mô hình "
                "nắm được mặt bằng giá."
            )
            return "thấp", notes

        if filled <= 1:
            notes.append(
                "Mới khai rất ít thông số. Bổ sung số phòng ngủ, số tầng và mặt tiền sẽ thu hẹp "
                "khoảng ước tính."
            )
            return "trung bình", notes

        if filled < 3:
            return "trung bình", notes

        return "cao", notes


def _round_vnd(value: float) -> float:
    """Làm tròn tới triệu đồng.

    Trả về "4.237.891.523 đồng" tạo cảm giác chính xác giả — mô hình không hề biết con số
    tới từng đồng, và hiển thị như vậy là nói dối bằng cách trình bày.
    """
    if not np.isfinite(value):
        return 0.0
    return float(round(value / 1_000_000) * 1_000_000)
