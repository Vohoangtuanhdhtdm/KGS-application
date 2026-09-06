"""Đặc trưng cho mô hình định giá.

Tệp này được dùng ở CẢ hai phía: lúc huấn luyện và lúc phục vụ dự đoán. Đó là chủ ý.

Sai lệch giữa đặc trưng lúc train và lúc serve ("training/serving skew") là lỗi kinh điển
của hệ thống ML và cũng là lỗi khó thấy nhất: mô hình vẫn trả về số, độ đo lúc train vẫn
đẹp, chỉ có dự đoán ngoài đời là sai. Cách chắc chắn nhất để nó không xảy ra là không có
hai bản cài đặt để mà lệch.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from .normalize import norm_district, norm_province, norm_ward

# Đặc trưng phân loại — LightGBM xử lý trực tiếp kiểu category, không cần one-hot.
CATEGORICAL = ["property_type", "province", "district", "ward", "house_direction"]

# Đặc trưng số.
NUMERIC = [
    "area",
    "log_area",
    "bedroom_count",
    "bathroom_count",
    "floor_count",
    "frontage_width",
    "house_depth",
    "road_width",
    "area_per_bedroom",
    "published_month",
]

FEATURES = CATEGORICAL + NUMERIC

TARGET = "log_price"


@dataclass(frozen=True)
class Bounds:
    """Ngưỡng lọc dữ liệu huấn luyện.

    Số liệu tin đăng có rất nhiều rác: giá 1 đồng, diện tích 99999m², người đăng gõ nhầm
    một số 0. Một giá trị sai kiểu đó kéo lệch mô hình mạnh hơn nhiều so với việc mất đi
    vài dòng dữ liệu tốt, nên thà cắt rộng tay.
    """

    min_price: float = 100_000_000        # 100 triệu — dưới mức này gần như chắc chắn là lỗi nhập
    max_price: float = 200_000_000_000    # 200 tỷ — trên mức này là bất động sản thương mại, khác thị trường
    min_area: float = 10.0
    max_area: float = 2_000.0
    min_price_per_m2: float = 1_000_000   # 1 triệu/m²
    max_price_per_m2: float = 800_000_000 # 800 triệu/m²


DEFAULT_BOUNDS = Bounds()


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Dựng bảng đặc trưng từ dữ liệu thô đã đổi tên cột.

    Nhận vào DataFrame có các cột: property_type, province, district, ward,
    house_direction, area, bedroom_count, bathroom_count, floor_count,
    frontage_width, house_depth, road_width, published_at.
    """
    out = pd.DataFrame(index=df.index)

    # ---- Phân loại ----
    out["property_type"] = df["property_type"].fillna("").astype(str).str.strip().str.lower()
    out["province"] = df["province"].map(norm_province)
    out["district"] = df["district"].map(norm_district)
    out["ward"] = df["ward"].map(norm_ward)
    out["house_direction"] = (
        df.get("house_direction", pd.Series(index=df.index, dtype=object))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    # ---- Số ----
    area = pd.to_numeric(df["area"], errors="coerce")
    out["area"] = area

    # log(diện tích): giá không tăng tuyến tính theo diện tích — một căn 200m² không đáng
    # gấp đôi căn 100m² ở cùng khu. Cho mô hình sẵn dạng log giúp nó không phải tự học lại
    # quan hệ đó từ dữ liệu thưa ở hai đầu phân bố.
    out["log_area"] = np.log1p(area.clip(lower=0))

    for col in ["bedroom_count", "bathroom_count", "floor_count",
                "frontage_width", "house_depth", "road_width"]:
        out[col] = pd.to_numeric(df.get(col), errors="coerce")

    # Diện tích mỗi phòng ngủ — phân biệt căn 60m² 1 phòng với căn 60m² 3 phòng, hai thứ
    # phục vụ hai nhóm người mua khác nhau và có giá khác nhau.
    with np.errstate(divide="ignore", invalid="ignore"):
        out["area_per_bedroom"] = area / out["bedroom_count"].replace(0, np.nan)

    # Tháng đăng, tính theo số tháng kể từ mốc cố định. Thị trường trôi theo thời gian; bỏ
    # trục thời gian đi thì mô hình coi giá năm ngoái và giá tháng này là một.
    published = pd.to_datetime(df.get("published_at"), errors="coerce", utc=True)
    out["published_month"] = (
        (published.dt.year - 2020) * 12 + published.dt.month
    ).astype("float64")

    return out


def to_categorical(df: pd.DataFrame, categories: dict[str, list[str]] | None = None) -> pd.DataFrame:
    """Ép các cột phân loại về kiểu ``category``.

    Khi phục vụ dự đoán, PHẢI truyền lại đúng tập hạng mục đã dùng lúc huấn luyện. Nếu để
    pandas tự suy ra từ một dòng dữ liệu, mã hạng mục sẽ khác hoàn toàn so với lúc train —
    LightGBM nhận vào số nguyên mã hoá, nên "quận 1" lúc serve có thể mang mã của "quận 12"
    lúc train. Mô hình vẫn chạy và vẫn trả về số; con số đó chỉ đơn giản là vô nghĩa.
    """
    out = df.copy()
    for col in CATEGORICAL:
        if categories is not None:
            out[col] = pd.Categorical(out[col], categories=categories[col])
        else:
            out[col] = out[col].astype("category")
    return out


def category_map(df: pd.DataFrame) -> dict[str, list[str]]:
    """Trích tập hạng mục để lưu kèm mô hình."""
    return {col: list(df[col].cat.categories) for col in CATEGORICAL}


def clean(df: pd.DataFrame, bounds: Bounds = DEFAULT_BOUNDS) -> pd.DataFrame:
    """Lọc các dòng không dùng được để huấn luyện, trả về bản đã lọc.

    Lọc theo giá TRÊN MỖI M² chứ không chỉ theo giá tuyệt đối: một căn 20 tỷ là bình thường
    nếu rộng 300m², nhưng là lỗi nhập nếu ghi 25m². Chỉ chặn hai đầu giá tuyệt đối thì bỏ
    lọt đúng loại rác gây hại nhất.
    """
    price = pd.to_numeric(df["price"], errors="coerce")
    area = pd.to_numeric(df["area"], errors="coerce")

    with np.errstate(divide="ignore", invalid="ignore"):
        ppm2 = price / area

    keep = (
        price.between(bounds.min_price, bounds.max_price)
        & area.between(bounds.min_area, bounds.max_area)
        & ppm2.between(bounds.min_price_per_m2, bounds.max_price_per_m2)
        & df["province"].notna()
        & df["district"].notna()
    )

    return df.loc[keep].copy()


def add_target(df: pd.DataFrame) -> pd.Series:
    """Mục tiêu là ``log(giá)``.

    Giá bất động sản lệch phải rất mạnh: phần lớn tin nằm quanh vài tỷ, một số ít lên tới
    hàng trăm tỷ. Hồi quy thẳng trên giá khiến hàm mất mát bị chi phối bởi nhóm đắt nhất,
    và sai 500 triệu ở một căn 50 tỷ bị phạt nặng như sai 500 triệu ở căn 1 tỷ — trong khi
    với người dùng, hai cái sai đó khác nhau một trời một vực.

    Trên thang log, sai số trở thành sai số TƯƠNG ĐỐI, đúng thứ mà người ta thực sự cảm nhận.
    """
    return np.log(pd.to_numeric(df["price"], errors="coerce"))


def prediction_input(payload: dict[str, Any]) -> pd.DataFrame:
    """Dựng một dòng đặc trưng từ yêu cầu dự đoán của API."""
    row = {
        "property_type": payload.get("property_type"),
        "province": payload.get("province"),
        "district": payload.get("district"),
        "ward": payload.get("ward"),
        "house_direction": payload.get("house_direction"),
        "area": payload.get("area"),
        "bedroom_count": payload.get("bedroom_count"),
        "bathroom_count": payload.get("bathroom_count"),
        "floor_count": payload.get("floor_count"),
        "frontage_width": payload.get("frontage_width"),
        "house_depth": payload.get("house_depth"),
        "road_width": payload.get("road_width"),
        "published_at": payload.get("published_at") or pd.Timestamp.utcnow(),
    }
    return build_features(pd.DataFrame([row]))
