"""Tải và chuẩn bị dữ liệu huấn luyện từ bộ tinixai/vietnam-real-estates.

Chạy:
    python -m training.prepare_data --shards 3 --provinces "ho chi minh"

Vì sao tải theo shard chứ không tải cả bộ: cả bộ là 1,67 GB nén / 3,5 triệu dòng. Với đồ án
chạy trên máy cá nhân, ba shard đầu đã cho hơn một triệu dòng — thừa sức huấn luyện, và
quan trọng hơn là rút vòng lặp thử nghiệm từ hàng chục phút xuống còn vài phút. Muốn dùng
toàn bộ thì chỉ cần đổi --shards 10, không phải sửa gì khác.

Bộ dữ liệu này CHỈ CÓ TIN BÁN (giá đều ở mức tỷ đồng, không có tin thuê). Đó là giới hạn
thật của nguồn dữ liệu, không phải lựa chọn của chúng ta, và nó quyết định phạm vi của AVM:
định giá được mảng mua bán, không định giá được giá thuê.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training._console import setup as _console_setup  # noqa: E402

_console_setup()

from app.features import DEFAULT_BOUNDS, clean  # noqa: E402
from app.normalize import norm_province  # noqa: E402

BASE_URL = "https://huggingface.co/api/datasets/tinixai/vietnam-real-estates/parquet/default/train"

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Đổi tên cột về đúng từ vựng của dự án. Làm ngay ở bước nạp để mọi tầng phía sau chỉ nhìn
# thấy một bộ tên duy nhất, thay vì rải rác chỗ dùng tên của bộ dữ liệu, chỗ dùng tên của mình.
COLUMN_MAP = {
    "property_type_name": "property_type",
    "province_name": "province",
    "district_name": "district",
    "ward_name": "ward",
    "street_name": "street",
    "project_name": "project",
    "house_direction": "house_direction",
    "balcony_direction": "balcony_direction",
    "price": "price",
    "area": "area",
    "floor_count": "floor_count",
    "frontage_width": "frontage_width",
    "house_depth": "house_depth",
    "road_width": "road_width",
    "bedroom_count": "bedroom_count",
    "bathroom_count": "bathroom_count",
    "published_at": "published_at",
    "name": "title",
    "description": "description",
}

KEEP = [c for c in COLUMN_MAP.values() if c not in ("description",)]


def load_shards(n: int) -> pd.DataFrame:
    frames = []
    for i in range(n):
        url = f"{BASE_URL}/{i}.parquet"
        print(f"  tải shard {i} …", flush=True)
        # Chỉ đọc các cột cần dùng: bỏ 'description' cắt được phần lớn dung lượng, mà nó
        # không tham gia mô hình định giá.
        df = pd.read_parquet(url, columns=list(COLUMN_MAP.keys()))
        df = df.rename(columns=COLUMN_MAP)
        frames.append(df[KEEP])
        print(f"    {len(df):,} dòng", flush=True)

    return pd.concat(frames, ignore_index=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards", type=int, default=3, help="Số shard parquet tải về (1–10).")
    ap.add_argument(
        "--provinces",
        default="",
        help="Lọc theo tỉnh, phân tách bởi dấu phẩy, dạng khoá không dấu. "
             "Bỏ trống để giữ toàn quốc.",
    )
    ap.add_argument("--out", default="prepared.parquet")
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Tải {args.shards} shard từ HuggingFace…")
    df = load_shards(max(1, min(args.shards, 10)))
    print(f"Tổng thô: {len(df):,} dòng")

    df["province_key"] = df["province"].map(norm_province)

    if args.provinces.strip():
        wanted = {p.strip() for p in args.provinces.split(",") if p.strip()}
        before = len(df)
        df = df[df["province_key"].isin(wanted)]
        print(f"Lọc theo tỉnh {sorted(wanted)}: {before:,} → {len(df):,}")

    before = len(df)
    df = clean(df, DEFAULT_BOUNDS)
    print(f"Lọc dữ liệu rác: {before:,} → {len(df):,} "
          f"(bỏ {before - len(df):,} dòng, {(before - len(df)) / max(before, 1) * 100:.1f}%)")

    # Bỏ trùng: một tin đăng lại nhiều lần sẽ vừa nằm ở tập huấn luyện vừa nằm ở tập kiểm
    # tra, và mô hình "đoán" đúng nó chỉ vì đã thấy rồi. Độ đo khi đó đẹp giả tạo.
    before = len(df)
    df = df.drop_duplicates(
        subset=["province", "district", "ward", "street", "area", "price", "bedroom_count"]
    )
    print(f"Bỏ tin trùng: {before:,} → {len(df):,}")

    out_path = DATA_DIR / args.out
    df.to_parquet(out_path, index=False)

    print(f"\nĐã ghi {out_path}  ({len(df):,} dòng)")
    print("\nPhân bố theo tỉnh (10 đầu):")
    print(df["province_key"].value_counts().head(10).to_string())
    print("\nPhân bố theo loại hình:")
    print(df["property_type"].value_counts().head(10).to_string())
    print(f"\nKhoảng thời gian đăng: {df['published_at'].min()} → {df['published_at'].max()}")


if __name__ == "__main__":
    main()
