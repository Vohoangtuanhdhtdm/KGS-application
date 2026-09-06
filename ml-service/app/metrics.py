"""Độ đo cho mô hình định giá tự động.

Chọn độ đo ở đây không phải chuyện hình thức — nó quyết định mô hình nào được coi là tốt
hơn, nên nếu chọn sai thì mọi so sánh về sau đều vô nghĩa.

RMSE trên giá tuyệt đối là lựa chọn sai cho bài toán này. Nó bị chi phối hoàn toàn bởi nhóm
bất động sản đắt nhất: sai 2 tỷ trên một căn 50 tỷ (4%) bị phạt nặng gấp trăm lần sai 200
triệu trên căn 1 tỷ (20%) — trong khi với người dùng, cái sai thứ hai mới là cái không chấp
nhận được.

Ngành định giá tự động dùng bộ độ đo khác, và đây là bộ được dùng ở dưới:

* **MdAPE** — trung vị sai số phần trăm tuyệt đối. Trung vị chứ không phải trung bình, vì
  vài tin rác còn sót lại đủ sức kéo MAPE trung bình đi mà không nói gì về chất lượng chung.
* **PPE10 / PPE20** — tỉ lệ dự đoán nằm trong sai số 10% / 20% so với giá thật. Đây là độ đo
  các nền tảng định giá công bố ra ngoài, vì nó trả lời đúng câu người dùng hỏi: "con số này
  đáng tin tới đâu?"
* **RMSLE** — sai số bình phương trên thang log, tương ứng với hàm mất mát lúc huấn luyện.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np


@dataclass(frozen=True)
class Scores:
    n: int
    mdape: float          # %
    mape: float           # %
    ppe10: float          # %
    ppe20: float          # %
    rmsle: float
    mae_vnd: float        # đồng
    median_ae_vnd: float  # đồng

    def as_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        return (
            f"n={self.n:,}  MdAPE={self.mdape:.2f}%  PPE10={self.ppe10:.1f}%  "
            f"PPE20={self.ppe20:.1f}%  RMSLE={self.rmsle:.4f}  "
            f"sai số trung vị={self.median_ae_vnd/1e6:,.0f} triệu"
        )


def evaluate(y_true_vnd: np.ndarray, y_pred_vnd: np.ndarray) -> Scores:
    """Tính bộ độ đo trên GIÁ THẬT (đồng), không phải trên thang log.

    Mô hình huấn luyện trên log(giá), nhưng báo cáo phải nói bằng đơn vị người đọc hiểu.
    Đổi ngược về đồng trước khi đo cũng là cách duy nhất để PPE10 có nghĩa.
    """
    y_true = np.asarray(y_true_vnd, dtype="float64")
    y_pred = np.asarray(y_pred_vnd, dtype="float64")

    valid = np.isfinite(y_true) & np.isfinite(y_pred) & (y_true > 0) & (y_pred > 0)
    y_true, y_pred = y_true[valid], y_pred[valid]

    if y_true.size == 0:
        return Scores(0, float("nan"), float("nan"), 0.0, 0.0, float("nan"), float("nan"), float("nan"))

    ape = np.abs(y_pred - y_true) / y_true * 100.0
    ae = np.abs(y_pred - y_true)
    sq_log_err = (np.log(y_pred) - np.log(y_true)) ** 2

    return Scores(
        n=int(y_true.size),
        mdape=float(np.median(ape)),
        mape=float(np.mean(ape)),
        ppe10=float(np.mean(ape <= 10.0) * 100.0),
        ppe20=float(np.mean(ape <= 20.0) * 100.0),
        rmsle=float(np.sqrt(np.mean(sq_log_err))),
        mae_vnd=float(np.mean(ae)),
        median_ae_vnd=float(np.median(ae)),
    )


def compare_table(results: dict[str, Scores]) -> str:
    """Bảng so sánh các mô hình, dạng văn bản thuần để dán thẳng vào báo cáo."""
    header = (
        f"{'Mô hình':<28}{'n':>9}{'MdAPE':>9}{'PPE10':>8}{'PPE20':>8}"
        f"{'RMSLE':>9}{'Sai số trung vị':>18}"
    )
    lines = [header, "-" * len(header)]

    for name, s in results.items():
        lines.append(
            f"{name:<28}{s.n:>9,}{s.mdape:>8.2f}%{s.ppe10:>7.1f}%{s.ppe20:>7.1f}%"
            f"{s.rmsle:>9.4f}{s.median_ae_vnd/1e6:>15,.0f} tr"
        )

    return "\n".join(lines)
