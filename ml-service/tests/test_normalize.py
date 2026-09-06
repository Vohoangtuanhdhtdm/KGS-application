"""Kiểm thử chuẩn hoá tên hành chính.

Đây là chỗ đáng kiểm thử nhất của cả Luồng B, vì nó là chỗ duy nhất có thể sai mà KHÔNG có
gì báo. Mô hình vẫn chạy, API vẫn trả về một con số, log vẫn sạch — chỉ là mọi tin đăng của
nền tảng đều rơi vào nhánh "quận chưa từng thấy" vì dữ liệu huấn luyện ghi "8" còn nền tảng
ghi "Quận 8".
"""

from __future__ import annotations

import pytest

from app.normalize import area_key, norm_district, norm_province, norm_ward, strip_accents


class TestStripAccents:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Thủ Đức", "Thu Duc"),
            ("Bà Rịa - Vũng Tàu", "Ba Ria - Vung Tau"),
            ("Đống Đa", "Dong Da"),
            ("Hồ Chí Minh", "Ho Chi Minh"),
            ("Tân Phú", "Tan Phu"),
        ],
    )
    def test_bo_dau(self, raw: str, expected: str) -> None:
        assert strip_accents(raw) == expected

    def test_chu_d_gach_ngang(self) -> None:
        # đ/Đ không mang dấu tổ hợp nên NFD không tách được — phải thay tay.
        # Bỏ bước đó thì "Đức" ra "c" hoặc giữ nguyên "Đ", cả hai đều hỏng khoá so khớp.
        assert strip_accents("đ") == "d"
        assert strip_accents("Đ") == "D"


class TestDistrict:
    @pytest.mark.parametrize(
        "raw",
        ["Quận 8", "quận 8", "Q.8", "Q 8", "8", "  Quận  8  "],
    )
    def test_moi_cach_viet_quan_8_ra_cung_khoa(self, raw: str) -> None:
        """Đây chính là ca hỏng thật: dữ liệu huấn luyện ghi "8", nền tảng ghi "Quận 8"."""
        assert norm_district(raw) == "8"

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("TP. Thủ Đức", "thu duc"),
            ("Thành phố Thủ Đức", "thu duc"),
            ("Thủ Đức", "thu duc"),
            ("Quận Bình Thạnh", "binh thanh"),
            ("Bình Thạnh", "binh thanh"),
            ("Huyện Củ Chi", "cu chi"),
            ("Bắc Từ Liêm", "bac tu liem"),
        ],
    )
    def test_cat_tien_to_don_vi_hanh_chinh(self, raw: str, expected: str) -> None:
        assert norm_district(raw) == expected

    def test_chi_co_moi_tien_to(self) -> None:
        # "Quận" trơ trọi không phải tên quận nào cả. Trả về "quan" sẽ tạo ra một hạng mục
        # rác gom mọi bản ghi thiếu dữ liệu vào một chỗ.
        assert norm_district("Quận") == ""
        assert norm_district("TP.") == ""

    def test_gia_tri_rong(self) -> None:
        assert norm_district(None) == ""
        assert norm_district("") == ""
        assert norm_district("   ") == ""


class TestProvince:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("TP. Hồ Chí Minh", "ho chi minh"),
            ("Thành phố Hồ Chí Minh", "ho chi minh"),
            ("Hồ Chí Minh", "ho chi minh"),
            ("HCM", "ho chi minh"),
            ("TPHCM", "ho chi minh"),
            ("Hà Nội", "ha noi"),
            ("Đà Nẵng", "da nang"),
        ],
    )
    def test_cac_bien_the(self, raw: str, expected: str) -> None:
        assert norm_province(raw) == expected


class TestWard:
    @pytest.mark.parametrize(
        "raw,expected",
        [("Phường 12", "12"), ("P.12", "12"), ("Xã Tân Thông Hội", "tan thong hoi")],
    )
    def test_phuong_xa(self, raw: str, expected: str) -> None:
        assert norm_ward(raw) == expected


class TestAreaKey:
    def test_ghep_ca_tinh(self) -> None:
        assert area_key("TP. Hồ Chí Minh", "Quận 1") == "ho chi minh|1"

    def test_hai_tinh_cung_ten_huyen_khong_bi_gop(self) -> None:
        # Nhiều tỉnh có huyện trùng tên. Gộp chúng lại làm hỏng đúng đặc trưng có sức dự báo
        # mạnh nhất của mô hình — mặt bằng giá theo khu vực.
        assert area_key("Vĩnh Long", "Bình Minh") != area_key("Lào Cai", "Bình Minh")

    def test_khop_giua_hai_nguon_du_lieu(self) -> None:
        """Cách viết của bộ dữ liệu huấn luyện và của nền tảng phải ra cùng một khoá."""
        tu_dataset = area_key("Hồ Chí Minh", "8")
        tu_nen_tang = area_key("TP. Hồ Chí Minh", "Quận 8")
        assert tu_dataset == tu_nen_tang
