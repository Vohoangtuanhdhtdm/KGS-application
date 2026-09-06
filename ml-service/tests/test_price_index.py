"""Kiểm thử phần thuần của chỉ số giá và dự báo.

Trọng tâm không phải "hàm có chạy không" mà là "hàm có nói thật không". Với chuỗi 19 tuần,
cám dỗ lớn nhất là để phần dự báo trả về một con số trông tinh vi mà không kèm cảnh báo nào
về việc nó dựa trên gì.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.price_index import _backtest, _drift, _naive, _ses, forecast


def series(values: list[float]) -> list[dict]:
    return [{"week_start": f"2025-06-{i + 1:02d}", "index": v, "n": 5000}
            for i, v in enumerate(values)]


class TestPhuongPhapDuBao:
    def test_ngay_tho_lap_lai_gia_tri_cuoi(self) -> None:
        assert _naive([100.0, 101.0, 99.5]) == 99.5

    def test_xu_huong_keo_dai_duong_thang(self) -> None:
        # Chuỗi tăng đều 1 điểm mỗi tuần thì bước tiếp theo phải là +1.
        assert _drift([100.0, 101.0, 102.0, 103.0]) == pytest.approx(104.0)

    def test_xu_huong_voi_chuoi_mot_diem(self) -> None:
        # Không đủ điểm để tính độ dốc — phải lùi về giá trị cuối chứ không chia cho 0.
        assert _drift([100.0]) == 100.0

    def test_lam_muot_nam_giua_dau_va_cuoi(self) -> None:
        vals = [100.0, 110.0, 120.0]
        out = _ses(vals)
        assert 100.0 < out < 120.0


class TestKiemTraLui:
    def test_chuoi_phang_cho_sai_so_bang_khong(self) -> None:
        vals = [100.0] * 12
        assert _backtest(vals, _naive, 4) == pytest.approx(0.0)

    def test_chuoi_tang_deu_thi_xu_huong_thang_ngay_tho(self) -> None:
        # Với xu hướng hoàn hảo, phương pháp xu hướng phải khớp tuyệt đối còn ngây thơ thì
        # luôn chậm một bước. Đây là phép kiểm tra rằng hàm chấm điểm thực sự phân biệt được
        # hai phương pháp, chứ không phải luôn chọn cái đầu tiên.
        vals = [100.0 + i for i in range(14)]
        assert _backtest(vals, _drift, 4) < _backtest(vals, _naive, 4)


class TestForecast:
    def test_chuoi_qua_ngan_tra_ve_none(self) -> None:
        # Thà không dự báo còn hơn dự báo từ 5 điểm rồi để người đọc tưởng nó có căn cứ.
        assert forecast(series([100, 101, 102, 101, 100])) is None

    def test_chuoi_du_dai_tra_ve_ket_qua(self) -> None:
        fc = forecast(series([100 + i * 0.5 for i in range(16)]))
        assert fc is not None
        assert fc.next_index > 100
        assert fc.backtest_mape >= 0

    def test_chuoi_nhieu_manh_bi_danh_dau_khong_dang_tin(self) -> None:
        rng = np.random.default_rng(7)
        noisy = [100 + float(rng.normal(0, 8)) for _ in range(16)]
        fc = forecast(series(noisy))
        assert fc is not None
        # Nhiễu biên độ 8 điểm thì sai số kiểm tra lùi chắc chắn vượt ngưỡng 2%.
        assert not fc.reliable

    def test_luon_kem_ghi_chu(self) -> None:
        fc = forecast(series([100 + i * 0.3 for i in range(16)]))
        assert fc is not None and fc.note

    def test_chuoi_phang_thi_ngay_tho_thang_va_noi_ro(self) -> None:
        fc = forecast(series([100.0] * 16))
        assert fc is not None
        assert fc.method.startswith("Ngây thơ")
        # Ngây thơ thắng là kết quả hợp lệ, nhưng phải nói rõ lý do cho người đọc.
        assert "chưa đủ dữ liệu" in fc.note
