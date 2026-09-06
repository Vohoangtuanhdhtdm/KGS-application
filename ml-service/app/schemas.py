"""Hợp đồng dữ liệu giữa dịch vụ định giá và phần còn lại của hệ thống."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ValuationRequest(BaseModel):
    """Yêu cầu định giá.

    Chỉ ``area``, ``province`` và ``district`` là bắt buộc. Mọi trường khác để trống được —
    và đó là chủ ý: tin đăng thật hầu như luôn thiếu vài mục, nếu bắt khai đủ mới định giá
    được thì tính năng này gần như không bao giờ dùng được. Càng khai nhiều thì khoảng tin
    cậy trả về càng hẹp, đó là cách hệ thống khuyến khích khai đủ mà không ép buộc.
    """

    area: float = Field(gt=0, le=10_000, description="Diện tích sử dụng, m²")
    province: str = Field(min_length=1, max_length=100)
    district: str = Field(min_length=1, max_length=100)
    ward: str | None = Field(default=None, max_length=100)

    property_type: str | None = Field(default=None, max_length=100)
    house_direction: str | None = Field(default=None, max_length=50)

    bedroom_count: float | None = Field(default=None, ge=0, le=50)
    bathroom_count: float | None = Field(default=None, ge=0, le=50)
    floor_count: float | None = Field(default=None, ge=0, le=100)
    frontage_width: float | None = Field(default=None, ge=0, le=200)
    house_depth: float | None = Field(default=None, ge=0, le=500)
    road_width: float | None = Field(default=None, ge=0, le=200)

    published_at: datetime | None = None


class ValuationResponse(BaseModel):
    price: float = Field(description="Giá ước tính, đồng")
    price_low: float = Field(description="Cận dưới khoảng tin cậy, đồng")
    price_high: float = Field(description="Cận trên khoảng tin cậy, đồng")
    price_per_m2: float

    confidence: str = Field(description="cao | trung bình | thấp")

    area_median_price_per_m2: float | None = Field(
        default=None,
        description="Giá trung vị mỗi m² của quận trong dữ liệu huấn luyện, để đối chiếu.",
    )
    area_sample_size: int = Field(
        default=0, description="Số tin đăng của quận đó trong dữ liệu huấn luyện."
    )

    notes: list[str] = Field(
        default_factory=list,
        description="Cảnh báo dành cho người đọc — vì sao con số này có thể kém tin cậy.",
    )


class ModelInfo(BaseModel):
    loaded: bool
    trained_at: str | None = None
    rows_fit: int | None = None
    mdape: float | None = None
    ppe10: float | None = None
    ppe20: float | None = None
    best_iteration: int | None = None
