"""Phân tích mốc thời gian của tin đăng.

Tách ra một chỗ vì nguồn dữ liệu ghi ISO KHÔNG đồng nhất: phần lớn có micro-giây
(``2025-06-01T05:12:56.941000``), một phần thì không (``2025-06-24T05:29:17``).

pandas suy định dạng từ dòng đầu rồi áp cho cả cột. Gặp dòng khác định dạng, nó ném lỗi —
hoặc tệ hơn, với ``errors="coerce"`` thì lặng lẽ biến dòng đó thành NaT. Ở đây đã đo được:
717 dòng bị bỏ theo đường ``coerce``, và không có gì báo. Con số nhỏ nên không ai để ý,
nhưng nó lớn dần theo dữ liệu, và với chuỗi chỉ số giá thì mất dòng nghĩa là lệch tuần.

``format="ISO8601"`` cho pandas phân tích từng phần tử theo chuẩn ISO thay vì áp một khuôn
cứng. Đọc được cả hai dạng, và ngày thật sự hỏng thì vẫn thành NaT như mong đợi.
"""

from __future__ import annotations

import pandas as pd


def parse_published(values) -> pd.Series:
    """Đọc cột thời gian đăng về datetime có múi giờ UTC."""
    return pd.to_datetime(values, format="ISO8601", utc=True, errors="coerce")
