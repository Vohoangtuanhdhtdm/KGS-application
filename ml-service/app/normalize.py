"""Chuẩn hoá tên hành chính Việt Nam.

Đây là mảnh ghép quyết định của cả Luồng B, và nó không hiển nhiên chút nào.

Bộ dữ liệu huấn luyện ghi quận là ``"8"``, ``"12"``, ``"Tân Phú"``, ``"Bắc Từ Liêm"``.
Nền tảng của chúng ta ghi ``"Quận 8"``, ``"Quận 12"``, ``"Quận Tân Phú"``, ``"TP. Thủ Đức"``.
Nếu không quy về một dạng, mô hình học được đặc trưng ``"8"`` sẽ không bao giờ khớp với tin
đăng mang quận ``"Quận 8"`` — và triệu chứng là thứ khó phát hiện nhất: mô hình vẫn chạy,
vẫn trả về một con số, chỉ là nó rơi vào nhánh "quận lạ" cho MỌI tin đăng thật. Không có
lỗi nào được ném ra, không có gì trong log, chỉ là kết quả sai lặng lẽ.

Quy tắc: mọi thứ về **dạng khoá** — chữ thường, không dấu, không tiền tố đơn vị hành chính.
"Quận 8", "quận 8", "Q.8", "8" đều thành ``"8"``.
"""

from __future__ import annotations

import re
import unicodedata

# Tiền tố đơn vị hành chính, sắp theo độ dài giảm dần để cụm dài được cắt trước cụm ngắn
# ("thanh pho" phải cắt trước "tp").
_PREFIXES = [
    "thanh pho",
    "quan",
    "huyen",
    "thi xa",
    "thi tran",
    "phuong",
    "xa",
    "tp",
    "tx",
    "tt",
    "q",
    "h",
    "p",
]

_MULTISPACE = re.compile(r"\s+")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")


def strip_accents(text: str) -> str:
    """Bỏ dấu tiếng Việt bằng chuẩn hoá Unicode.

    Dùng NFD rồi loại ký tự tổ hợp, KHÔNG dùng bảng tra hai chuỗi song song — bảng căn tay
    lệch một ký tự là toàn bộ phần sau lệch theo, và lỗi đó không tự lộ ra.

    ``đ``/``Đ`` không phải nguyên âm mang dấu tổ hợp nên NFD không tách được, phải thay tay.
    """
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return unicodedata.normalize("NFC", stripped).replace("đ", "d").replace("Đ", "D")


def norm_key(value: str | None) -> str:
    """Đưa một tên địa danh về dạng khoá dùng để so khớp."""
    if not value:
        return ""

    text = strip_accents(str(value)).lower()
    text = _NON_ALNUM.sub(" ", text)
    text = _MULTISPACE.sub(" ", text).strip()

    # Cắt tiền tố lặp lại: "tp thu duc" -> "thu duc"; "quan 8" -> "8".
    # Lặp vì có chuỗi như "tp. thu duc" sau khi bỏ dấu chấm còn "tp thu duc",
    # và vài nguồn ghi "quan quan 1" do ghép máy móc.
    changed = True
    while changed:
        changed = False
        for prefix in _PREFIXES:
            if text == prefix:
                # Chỉ còn mỗi tiền tố thì không còn tên nào — trả rỗng thay vì trả "quan".
                return ""
            if text.startswith(prefix + " "):
                text = text[len(prefix) + 1 :].strip()
                changed = True
                break

    return text


def norm_province(value: str | None) -> str:
    """Khoá tỉnh/thành. ``"TP. Hồ Chí Minh"``, ``"Hồ Chí Minh"``, ``"HCM"`` cùng ra một khoá."""
    key = norm_key(value)
    return _PROVINCE_ALIASES.get(key, key)


def norm_district(value: str | None) -> str:
    """Khoá quận/huyện."""
    return norm_key(value)


def norm_ward(value: str | None) -> str:
    """Khoá phường/xã."""
    return norm_key(value)


# Vài cách viết tắt phổ biến. Danh sách cố tình ngắn: chỉ những biến thể thực sự gặp trong
# dữ liệu, chứ không phải mọi cách viết có thể tưởng tượng ra.
_PROVINCE_ALIASES = {
    "hcm": "ho chi minh",
    "tphcm": "ho chi minh",
    "sai gon": "ho chi minh",
    "hn": "ha noi",
    "dn": "da nang",
    "brvt": "ba ria vung tau",
}


def area_key(province: str | None, district: str | None) -> str:
    """Khoá khu vực dùng cho bảng tra giá theo vùng.

    Ghép cả tỉnh vào: nhiều tỉnh cùng có huyện tên giống nhau (một "Bình Minh" ở Vĩnh Long
    không liên quan gì tới mặt bằng giá của một "Bình Minh" nơi khác), và gộp nhầm chúng
    làm hỏng chính đặc trưng có sức dự báo mạnh nhất của mô hình.
    """
    return f"{norm_province(province)}|{norm_district(district)}"
