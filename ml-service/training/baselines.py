"""Các mô hình nền (nhiệm vụ 2.3).

Một mô hình học máy chỉ có nghĩa khi đặt cạnh thứ nó phải vượt qua. Không có mốc so sánh
thì con số MdAPE 18% chẳng nói lên điều gì — có thể đó là kết quả xuất sắc, cũng có thể tệ
hơn cả phép nhân đơn giản "diện tích × giá trung vị mỗi m² của quận".

Ba mốc dưới đây xếp theo độ khó tăng dần:

1. **Giá trung vị mỗi m² toàn quốc** — mốc sàn. Mô hình nào không vượt được mốc này thì
   coi như không học được gì.
2. **Giá trung vị mỗi m² theo quận** — mốc THẬT SỰ đáng ngại. Trong bất động sản, vị trí
   giải thích phần lớn biến thiên giá, nên một bảng tra theo quận đã rất mạnh. Đây là mốc
   mà mô hình phức tạp phải vượt để chứng minh nó đáng tồn tại.
3. **Hồi quy tuyến tính trên log(giá)** — mốc "có học máy nhưng đơn giản nhất".

Cả ba đều dùng chung một hàm đánh giá với mô hình chính, trên đúng cùng một tập kiểm tra.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer

from app.features import CATEGORICAL, NUMERIC


class GlobalMedianPPM2:
    """Giá = diện tích × giá trung vị mỗi m² của toàn tập huấn luyện."""

    name = "Nền 1 · Trung vị giá/m² toàn quốc"

    def fit(self, X: pd.DataFrame, price: np.ndarray) -> "GlobalMedianPPM2":
        ppm2 = price / X["area"].to_numpy()
        self.ppm2_ = float(np.median(ppm2[np.isfinite(ppm2)]))
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return X["area"].to_numpy() * self.ppm2_


class DistrictMedianPPM2:
    """Giá = diện tích × giá trung vị mỗi m² của chính quận đó.

    Quận lạ (không có trong tập huấn luyện) lùi về trung vị tỉnh, rồi tới trung vị toàn quốc.
    Chuỗi lùi này quan trọng: bỏ nó đi thì mọi tin ở một quận mới sẽ trả về NaN, và trong
    sản phẩm thật thì "không có giá" tệ hơn "giá thô nhưng có căn cứ".
    """

    name = "Nền 2 · Trung vị giá/m² theo quận"

    def fit(self, X: pd.DataFrame, price: np.ndarray) -> "DistrictMedianPPM2":
        df = X[["province", "district"]].copy()
        df["ppm2"] = price / X["area"].to_numpy()
        df = df[np.isfinite(df["ppm2"])]

        self.by_district_ = df.groupby(["province", "district"])["ppm2"].median()
        self.by_province_ = df.groupby("province")["ppm2"].median()
        self.global_ = float(df["ppm2"].median())
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        idx = pd.MultiIndex.from_arrays([X["province"], X["district"]])
        ppm2 = self.by_district_.reindex(idx).to_numpy()

        fallback_province = self.by_province_.reindex(X["province"]).to_numpy()
        ppm2 = np.where(np.isnan(ppm2), fallback_province, ppm2)
        ppm2 = np.where(np.isnan(ppm2), self.global_, ppm2)

        return X["area"].to_numpy() * ppm2


class RidgeLogPrice:
    """Hồi quy tuyến tính có phạt, trên log(giá).

    Dùng Ridge chứ không phải hồi quy thường: one-hot của hàng trăm quận tạo ra ma trận rất
    thưa và gần cộng tuyến, hồi quy thường sẽ cho hệ số nổ tung ở những quận chỉ có vài tin.
    """

    name = "Nền 3 · Hồi quy tuyến tính (Ridge)"

    # Bỏ 'ward' khỏi one-hot: hàng nghìn phường thổi ma trận lên rất lớn mà thêm được rất ít
    # so với quận. Mô hình GBM thì không gặp vấn đề đó nên vẫn dùng đủ.
    CAT = [c for c in CATEGORICAL if c != "ward"]

    def fit(self, X: pd.DataFrame, price: np.ndarray) -> "RidgeLogPrice":
        self.pipe_ = make_pipeline(
            ColumnTransformer(
                [
                    ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=20), self.CAT),
                    (
                        "num",
                        make_pipeline(SimpleImputer(strategy="median"), StandardScaler()),
                        NUMERIC,
                    ),
                ]
            ),
            Ridge(alpha=1.0),
        )
        self.pipe_.fit(X, np.log(price))
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return np.exp(self.pipe_.predict(X))


ALL_BASELINES = [GlobalMedianPPM2, DistrictMedianPPM2, RidgeLogPrice]
