"""Dịch vụ định giá bất động sản (nhiệm vụ 2.2).

Chạy:
    uvicorn app.main:app --port 8000

Vì sao tách thành dịch vụ Python riêng thay vì nhúng mô hình vào API .NET:

* Hệ sinh thái. LightGBM, pandas, scikit-learn đều sống ở Python. Gọi chúng từ .NET nghĩa là
  hoặc chấp nhận một cầu nối mong manh, hoặc dùng bản chuyển đổi luôn chậm hơn bản gốc vài
  phiên bản.
* Vòng đời khác nhau. Mô hình được huấn luyện lại khi có dữ liệu mới; API nghiệp vụ thì thay
  đổi theo tính năng. Buộc chúng vào một tiến trình nghĩa là mỗi lần huấn luyện lại phải
  triển khai lại cả sàn giao dịch.
* Hỏng độc lập. Dịch vụ này chết thì trang tin đăng vẫn chạy — bên .NET chỉ đơn giản không
  hiện ô định giá. Nhúng chung thì một lỗi trong thư viện ML kéo sập cả nền tảng.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status

from .predict import Model
from .price_index import PriceIndex, forecast
from .schemas import (
    ModelInfo,
    PriceIndexResponse,
    ValuationRequest,
    ValuationResponse,
)

log = logging.getLogger("avm")

model = Model()
price_index = PriceIndex()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Nạp mô hình MỘT LẦN lúc khởi động, không nạp theo từng request: đọc và dựng lại booster
    # tốn hàng trăm mili giây, làm việc đó cho mỗi lần định giá là tự biến một dịch vụ nhanh
    # thành dịch vụ chậm mà không được gì.
    if model.load():
        r = model.report.get("results", {}).get("Gradient Boosting (LightGBM)", {})
        log.info("Đã nạp mô hình. MdAPE=%.2f%% PPE10=%.1f%%", r.get("mdape", 0), r.get("ppe10", 0))
    else:
        # KHÔNG dừng tiến trình. Dịch vụ vẫn phải khởi động được để /health nói rõ vì sao nó
        # chưa dùng được — một container thoát ngay lúc khởi động chỉ để lại đúng một dòng log.
        log.warning("Chưa có mô hình trong thư mục models/. Hãy chạy training.train.")

    # Chỉ số giá nạp độc lập với mô hình định giá: hai thứ dựng bằng hai lệnh khác nhau và
    # thiếu cái này không có nghĩa là thiếu cái kia.
    if price_index.load():
        log.info("Đã nạp chỉ số giá (%d tuần).",
                 len(price_index.national().get("points", [])))
    else:
        log.warning("Chưa có chỉ số giá. Hãy chạy training.build_index.")
    yield


app = FastAPI(
    title="KGS · Dịch vụ định giá bất động sản",
    version="1.0.0",
    description="Ước tính giá bán bất động sản từ vị trí, diện tích và đặc điểm căn nhà.",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if model.ready else "chưa có mô hình",
        "model_loaded": model.ready,
        "index_loaded": price_index.ready,
    }


@app.get("/model-info", response_model=ModelInfo)
def model_info() -> ModelInfo:
    """Thông tin mô hình đang phục vụ, kèm độ đo đo được lúc huấn luyện.

    Công khai độ đo là có chủ ý: bên gọi cần biết sai số điển hình để quyết định hiển thị
    con số này như thế nào, chứ không phải đoán mò.
    """
    if not model.ready:
        return ModelInfo(loaded=False)

    rep = model.report
    gbm = rep.get("results", {}).get("Gradient Boosting (LightGBM)", {})

    return ModelInfo(
        loaded=True,
        trained_at=rep.get("trained_at"),
        rows_fit=rep.get("rows_fit"),
        mdape=gbm.get("mdape"),
        ppe10=gbm.get("ppe10"),
        ppe20=gbm.get("ppe20"),
        best_iteration=rep.get("best_iteration"),
    )


@app.post("/valuation", response_model=ValuationResponse)
def valuation(req: ValuationRequest) -> ValuationResponse:
    if not model.ready:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mô hình định giá chưa sẵn sàng.",
        )

    try:
        result = model.predict(req.model_dump())
    except Exception as exc:  # pragma: no cover - đường phòng vệ
        log.exception("Định giá thất bại")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không tính được giá ước tính."
        ) from exc

    return ValuationResponse(**result)


@app.get("/price-index", response_model=PriceIndexResponse)
def get_price_index(province: str | None = None, district: str | None = None) -> PriceIndexResponse:
    """Chỉ số giá theo tuần.

    Có ``province`` và ``district`` thì trả chuỗi riêng của quận đó nếu đã dựng được; không
    thì lùi về chuỗi toàn quốc. Lùi chứ không trả lỗi: người xem một tin ở quận nhỏ vẫn cần
    thấy thị trường chung, và một ô trống thì không nói gì cả.
    """
    if not price_index.ready:
        return PriceIndexResponse(available=False, scope="toàn quốc")

    meta = price_index.meta
    area = price_index.for_area(province, district) if district else None

    if area is not None:
        series = area["points"]
        scope = f"{area['district']}"
        naive: list = []
        gap: dict = {}
    else:
        national = price_index.national()
        series = national["points"]
        scope = "toàn quốc"
        naive = price_index.naive_median()["points"]
        gap = price_index.mix_shift_gap()

    fc = forecast(series)

    return PriceIndexResponse(
        available=True,
        scope=scope,
        points=series,
        naive_points=naive,
        change_points=(area or price_index.national()).get("change_points"),
        weekly_volatility=(area or price_index.national()).get("weekly_volatility"),
        mix_shift_mean_points=gap.get("mean_points"),
        mix_shift_max_points=gap.get("max_points"),
        forecast=fc.__dict__ if fc else None,
        base_week=meta.get("base_week"),
        built_at=meta.get("built_at"),
        method=meta.get("method"),
        rows=meta.get("rows"),
        caveats=meta.get("caveats", []),
    )
