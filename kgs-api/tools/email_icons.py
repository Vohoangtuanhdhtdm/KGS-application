"""Dựng bộ biểu tượng nét mảnh cho khung chi tiết của email: kgs-api/kgs-api/Assets/Email/icon-*.png

Emoji trông khác nhau trên từng máy (và lộ vẻ "máy tạo"), nên email dùng biểu tượng vẽ tay cùng
một nét, cùng màu thương hiệu, nhúng thẳng vào thư (cid:icon-…) như KiGi.

Chạy:  python email_icons.py   (cần Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

S = 16          # vẽ trên lưới 24 × S rồi thu nhỏ để nét mượt
OUT = 40        # px — hiện ở 20px trong email, nét trên màn hình mật độ cao
STROKE = 1.8    # độ dày nét theo đơn vị lưới 24 (giống bộ lucide trên web)
NAVY = (30, 39, 97, 255)


def canvas():
    img = Image.new("RGBA", (24 * S, 24 * S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def w():
    return round(STROKE * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def user():
    img, d = canvas()
    d.ellipse(box(8, 3, 16, 11), outline=NAVY, width=w())
    d.arc(box(4, 13.5, 20, 29.5), 200, 340, fill=NAVY, width=w())
    return img


def phone():
    img, d = canvas()
    d.rounded_rectangle(box(6.5, 2.5, 17.5, 21.5), radius=2.5 * S, outline=NAVY, width=w())
    d.line([(10.5 * S, 18 * S), (13.5 * S, 18 * S)], fill=NAVY, width=w())
    return img


def calendar():
    img, d = canvas()
    d.rounded_rectangle(box(3.5, 5, 20.5, 21), radius=2.5 * S, outline=NAVY, width=w())
    d.line([(3.5 * S, 10 * S), (20.5 * S, 10 * S)], fill=NAVY, width=w())
    for x in (8, 16):
        d.line([(x * S, 2.5 * S), (x * S, 7 * S)], fill=NAVY, width=w())
    for x, y in ((8, 14.5), (12, 14.5), (16, 14.5), (8, 18)):
        d.ellipse(box(x - 0.9, y - 0.9, x + 0.9, y + 0.9), fill=NAVY)
    return img


def message():
    img, d = canvas()
    d.rounded_rectangle(box(3, 4, 21, 17), radius=3 * S, outline=NAVY, width=w())
    tail = [(7.5 * S, 16.2 * S), (7.5 * S, 21 * S), (12.5 * S, 16.2 * S)]
    d.line(tail, fill=NAVY, width=w(), joint="curve")
    d.polygon([(8.4 * S, 16.9 * S), (8.4 * S, 18.6 * S), (10.4 * S, 16.9 * S)], fill=(0, 0, 0, 0))
    for x in (8, 12, 16):
        d.ellipse(box(x - 1, 10.5 - 1, x + 1, 10.5 + 1), fill=NAVY)
    return img


def tip():
    """Bóng đèn nhỏ cho ô "KiGi mách bạn" — thay emoji 💡."""
    img, d = canvas()
    amber = (180, 120, 20, 255)
    d.arc(box(5.5, 2.5, 18.5, 15.5), 150, 390, fill=amber, width=w())
    d.line([(8.4 * S, 13.4 * S), (9.5 * S, 17 * S)], fill=amber, width=w())
    d.line([(15.6 * S, 13.4 * S), (14.5 * S, 17 * S)], fill=amber, width=w())
    d.line([(9.5 * S, 17.5 * S), (14.5 * S, 17.5 * S)], fill=amber, width=w())
    d.line([(10 * S, 21 * S), (14 * S, 21 * S)], fill=amber, width=w())
    return img


def main():
    out = Path(__file__).resolve().parents[1] / "kgs-api" / "Assets" / "Email"
    out.mkdir(parents=True, exist_ok=True)
    for name, draw in [("user", user), ("phone", phone), ("calendar", calendar),
                       ("message", message), ("tip", tip)]:
        path = out / f"icon-{name}.png"
        draw().resize((OUT, OUT), Image.LANCZOS).save(path, optimize=True)
        print(path.name, path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
