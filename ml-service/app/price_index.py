"""Phục vụ chỉ số giá theo tuần và dự báo ngắn hạn (nhiệm vụ 3.3).

Về phần dự báo, cần nói thẳng ngay từ đầu: **19 tuần dữ liệu là quá ít để dự báo tử tế.**
Chuỗi thời gian cần vài chu kỳ mới nói được gì về xu hướng, chứ chưa nói tới mùa vụ. Ở đây
vẫn dựng phần dự báo vì nó là một nhiệm vụ của kế hoạch, nhưng dựng theo cách trung thực:

* dùng ba phương pháp đơn giản nhất, trong đó có mô hình ngây thơ ("tuần tới bằng tuần này"),
* đo cả ba trên phần cuối của chuỗi,
* và báo cáo thẳng nếu mô hình ngây thơ thắng.

Mô hình ngây thơ thắng là một kết quả HỢP LỆ và đáng báo cáo, không phải một thất bại cần
giấu đi. Với chuỗi ngắn và nhiễu, nó thường thắng thật — và biết điều đó có giá trị hơn là
một con số dự báo trông có vẻ tinh vi mà không ai kiểm chứng được.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .normalize import norm_district, norm_province

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"


@dataclass
class ForecastResult:
    method: str
    next_index: float
    change_percent: float
    """Sai số phần trăm tuyệt đối trung bình khi kiểm tra lùi trên phần cuối chuỗi."""
    backtest_mape: float
    reliable: bool
    note: str


class PriceIndex:
    """Nạp chỉ số một lần lúc khởi động, phục vụ lại cho mọi request."""

    def __init__(self, name: str = "price_index") -> None:
        self.name = name
        self._data: dict | None = None

    def load(self) -> bool:
        path = MODEL_DIR / f"{self.name}.json"
        if not path.exists():
            return False
        self._data = json.loads(path.read_text(encoding="utf-8"))
        return True

    @property
    def ready(self) -> bool:
        return self._data is not None

    @property
    def meta(self) -> dict:
        if not self._data:
            return {}
        return {
            "built_at": self._data.get("built_at"),
            "method": self._data.get("method"),
            "base_week": self._data.get("base_week"),
            "rows": self._data.get("rows"),
            "caveats": self._data.get("caveats", []),
        }

    def national(self) -> dict:
        assert self._data
        return self._data["national"]

    def naive_median(self) -> dict:
        assert self._data
        return self._data["naive_median"]

    def mix_shift_gap(self) -> dict:
        assert self._data
        return self._data.get("mix_shift_gap", {})

    def districts(self) -> list[dict]:
        assert self._data
        return self._data.get("districts", [])

    def for_area(self, province: str | None, district: str | None) -> dict | None:
        """Chỉ số của một quận, hoặc None nếu quận đó không có chuỗi riêng.

        So khớp qua cùng hàm chuẩn hoá mà mô hình định giá dùng — "Quận 8" của nền tảng phải
        tìm được chuỗi dựng trên khoá "8" của dữ liệu huấn luyện.
        """
        if not self._data:
            return None

        p, d = norm_province(province), norm_district(district)
        for row in self._data.get("districts", []):
            if row["province"] == p and row["district"] == d:
                return row
        return None


# ---------- Dự báo ----------

def _backtest(values: list[float], predict, holdout: int) -> float:
    """Sai số phần trăm tuyệt đối trung bình khi dự báo một bước, trượt trên phần cuối chuỗi."""
    errs = []
    for i in range(len(values) - holdout, len(values)):
        pred = predict(values[:i])
        errs.append(abs(pred - values[i]) / values[i] * 100.0)
    return float(np.mean(errs)) if errs else float("nan")


def _naive(hist: list[float]) -> float:
    """Tuần tới bằng tuần này."""
    return hist[-1]


def _drift(hist: list[float]) -> float:
    """Kéo dài đường thẳng nối điểm đầu và điểm cuối."""
    if len(hist) < 2:
        return hist[-1]
    slope = (hist[-1] - hist[0]) / (len(hist) - 1)
    return hist[-1] + slope


def _ses(hist: list[float], alpha: float = 0.4) -> float:
    """Làm mượt hàm mũ đơn giản."""
    level = hist[0]
    for v in hist[1:]:
        level = alpha * v + (1 - alpha) * level
    return level


_METHODS = [
    ("Ngây thơ (tuần tới = tuần này)", _naive),
    ("Xu hướng tuyến tính", _drift),
    ("Làm mượt hàm mũ", _ses),
]

# Dưới ngưỡng này thì kiểm tra lùi chỉ có vài điểm và con số MAPE thu được tự nó cũng là
# nhiễu — không đủ căn cứ để nói phương pháp nào tốt hơn.
_MIN_POINTS_FOR_FORECAST = 10
_HOLDOUT = 4


def forecast(points: list[dict]) -> ForecastResult | None:
    """Chọn phương pháp dự báo tốt nhất bằng kiểm tra lùi, rồi dự báo một tuần tới."""
    values = [p["index"] for p in points]

    if len(values) < _MIN_POINTS_FOR_FORECAST:
        return None

    scored = [
        (name, fn, _backtest(values, fn, _HOLDOUT))
        for name, fn in _METHODS
    ]
    scored.sort(key=lambda x: x[2])
    name, fn, mape = scored[0]

    nxt = fn(values)
    change = (nxt - values[-1]) / values[-1] * 100.0

    # Dự báo chỉ đáng tin khi sai số kiểm tra lùi nhỏ hơn hẳn mức biến động của chính chuỗi.
    # Không có điều kiện đó thì "dự báo" chỉ là vẽ lại nhiễu.
    volatility = float(np.std(np.diff(values))) if len(values) > 1 else 0.0
    reliable = mape < 2.0 and volatility > 0

    if scored[0][0].startswith("Ngây thơ"):
        note = (
            "Mô hình ngây thơ cho sai số thấp nhất — với chuỗi 19 tuần, đó là kết quả bình "
            "thường và có nghĩa là chưa đủ dữ liệu để dự báo tốt hơn phép đoán 'giữ nguyên'."
        )
    else:
        note = f"Chọn theo kiểm tra lùi {_HOLDOUT} tuần cuối."

    return ForecastResult(
        method=name,
        next_index=round(nxt, 2),
        change_percent=round(change, 2),
        backtest_mape=round(mape, 3),
        reliable=reliable,
        note=note,
    )
