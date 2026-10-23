"""Dựng KiGi động (GIF) cho email: kgs-api/kgs-api/Assets/Email/kigi.gif

Email không chạy được SVG hay CSS animation (Gmail, Outlook bỏ đi), nên KiGi trong email là GIF
nhúng thẳng vào thư (cid:kigi). Hình vẽ theo đúng KiGiMascot.tsx (khung 160×160): ống khói, mái,
thân nhà bo góc, má hồng, mắt, miệng cười. Chuyển động: thở nhẹ, lắc lư, chớp mắt, khói bay.

Chạy:  python kigi_email_gif.py   (cần Pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

S = 6  # vẽ to rồi thu nhỏ để nét mượt
OUT = 192  # px — hiện ở 96px trong email, đủ nét trên màn hình mật độ cao
FRAMES = 36
FRAME_MS = 70

PRIMARY = (30, 39, 97)  # #1E2761
CARD = (255, 255, 255)
INK = (17, 24, 39)
CHEEK = (251, 206, 229)
SMOKE = (203, 208, 226)


def p(x, y):
    return (x * S, y * S)


def quad(a, c, b, n=24):
    """Điểm trên đường cong bậc hai a → b với điểm điều khiển c."""
    return [
        p((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
          (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])
        for t in (i / n for i in range(n + 1))
    ]


def frame(i):
    t = i / FRAMES
    img = Image.new("RGB", (160 * S, 160 * S), CARD)
    d = ImageDraw.Draw(img)

    # Khói: ba cụm bay lên từ ống khói, mờ dần.
    for k in range(3):
        u = (t + k / 3) % 1
        r = 3 + u * 6
        x, y = 110 + math.sin(u * math.pi * 2) * 4 + u * 6, 26 - u * 17
        shade = tuple(int(SMOKE[c] + (CARD[c] - SMOKE[c]) * u) for c in range(3))
        d.ellipse([p(x - r, y - r), p(x + r, y + r)], fill=shade)

    body = Image.new("RGBA", img.size, (0, 0, 0, 0))
    b = ImageDraw.Draw(body)
    bob = math.sin(t * math.pi * 2) * 2.2  # thở: nhấp nhô nhẹ

    def q(x, y):
        return p(x, y + bob)

    b.rounded_rectangle([q(104, 30), q(116, 54)], radius=3 * S, fill=PRIMARY)  # ống khói
    roof = [q(80, 22), q(142, 72), q(140, 78), q(20, 78), q(18, 72)]
    b.polygon(roof, fill=PRIMARY)
    b.line(roof + [roof[0]], fill=PRIMARY, width=4 * S, joint="curve")
    b.rounded_rectangle([q(30, 66), q(130, 140)], radius=16 * S, fill=CARD, outline=PRIMARY, width=4 * S)

    for cx in (50, 110):  # má hồng
        b.ellipse([q(cx - 6, 102), q(cx + 6, 114)], fill=CHEEK)

    blink = 0.80 <= t < 0.86  # chớp mắt một lần mỗi vòng
    for cx in (62, 98):
        if blink:
            b.rounded_rectangle([q(cx - 6, 91), q(cx + 6, 94)], radius=1.5 * S, fill=INK)
        else:
            b.ellipse([q(cx - 6, 86), q(cx + 6, 98)], fill=INK)
            b.ellipse([q(cx, 88), q(cx + 4, 92)], fill=CARD)

    smile = [(x, y + bob) for x, y in [(70, 114), (80, 124), (90, 114)]]
    b.line(quad(*smile), fill=INK, width=3 * S, joint="curve")

    sway = math.sin(t * math.pi * 2) * 3  # lắc lư quanh chân nhà
    body = body.rotate(sway, resample=Image.BICUBIC, center=p(80, 140))
    img.paste(body, (0, 0), body)
    return img.resize((OUT, OUT), Image.LANCZOS)


def main():
    # Một bảng màu chung cho mọi khung: khung sau chỉ khác vài điểm ảnh, GIF nén nhỏ hơn nhiều.
    raw = [frame(i) for i in range(FRAMES)]
    palette = raw[0].quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in raw]
    # quantize(palette=…) kéo nền trắng thành (251,252,252) — trên thẻ trắng của email thành một ô
    # hơi xám quanh KiGi. Đổi ô màu của điểm nền (góc trái trên, luôn là nền) về trắng tuyệt đối.
    bg = frames[0].getpixel((0, 0))
    pal = frames[0].getpalette()
    pal[bg * 3 : bg * 3 + 3] = [255, 255, 255]
    for f in frames:
        f.putpalette(pal)
    out = Path(__file__).resolve().parents[1] / "kgs-api" / "Assets" / "Email" / "kigi.gif"
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=FRAME_MS, loop=0,
                   optimize=True, disposal=1)
    print(out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
