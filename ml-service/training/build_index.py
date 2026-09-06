"""Chỉ số giá bất động sản theo tuần (nhiệm vụ 3.1 – 3.2).

Chạy:
    python -m training.build_index

VÌ SAO KHÔNG DÙNG GIÁ TRUNG VỊ THEO TUẦN

Cách hiển nhiên nhất — lấy trung vị giá mỗi m² của từng tuần rồi vẽ lên — là cách SAI, và
sai theo kiểu rất khó nhận ra vì đường biểu đồ trông vẫn hợp lý.

Vấn đề là **thay đổi cơ cấu** (mix shift). Tuần này ngẫu nhiên có nhiều tin ở Quận 1 hơn,
trung vị nhảy lên; tuần sau nhiều tin ở Bình Tân hơn, trung vị rơi xuống. Không có căn nhà
nào đổi giá cả — chỉ là danh mục tin đăng đổi thành phần. Một chỉ số như vậy đo hoạt động
đăng tin, không đo thị trường, và nó sẽ báo "giá tăng 8%" vào đúng tuần mà chẳng có gì tăng.

CÁCH ĐÚNG: CHỈ SỐ HEDONIC

Hồi quy log(giá) theo đặc điểm bất động sản CỘNG các biến giả tuần:

    log(P_i) = α + Σ β_k · X_ik + Σ δ_t · D_it + ε_i

Các hệ số δ_t chính là chỉ số: chúng đo phần biến động giá còn lại SAU khi đã trừ đi ảnh
hưởng của quận, diện tích, loại hình, số phòng. Nói cách khác, δ_t trả lời đúng câu hỏi
cần hỏi — "cùng một căn nhà như thế, tuần này đắt hơn hay rẻ hơn tuần gốc bao nhiêu?"

Đây là phương pháp chuẩn của các cơ quan thống kê khi dựng chỉ số giá nhà. Tệp này dựng cả
hai đường — trung vị thô và hedonic — chính là để cho thấy khoảng cách giữa chúng.

GIỚI HẠN THẬT CỦA DỮ LIỆU

Dữ liệu trải 19 tuần (01/06 → 29/09/2025), trong đó tuần đầu và tuần cuối bị cắt cụt, và
số tin từ tháng 9 rơi xuống còn 1/4 so với tháng 6–8. Sụt đó là dấu vết của việc thu thập
dữ liệu, KHÔNG phải tín hiệu thị trường. Vì vậy:

  • chỉ dựng chỉ số cho các tuần có đủ mẫu,
  • luôn trả kèm cỡ mẫu và khoảng tin cậy từng tuần,
  • và không mô hình hoá tính mùa vụ — 19 tuần không đủ để nói gì về mùa.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training._console import setup as _console_setup  # noqa: E402

_console_setup()

from sklearn.linear_model import Ridge  # noqa: E402
from sklearn.preprocessing import OneHotEncoder  # noqa: E402
from scipy import sparse  # noqa: E402

from app.features import build_features  # noqa: E402
from app.timeparse import parse_published  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"

# Tuần có ít hơn ngần này tin thì hệ số của nó chủ yếu là nhiễu. Loại khỏi chỉ số và nói rõ
# đã loại, thay vì để một điểm rung lắc mạnh trên biểu đồ mà người xem tưởng là thị trường.
MIN_WEEK_SAMPLE = 3_000

# Ngưỡng cho chuỗi CẤP QUẬN phải thấp hơn hẳn, và đây là chỗ dễ sai.
#
# Áp thẳng ngưỡng toàn quốc xuống cấp quận thì gần như không quận nào đạt — mỗi quận chỉ
# chiếm vài phần trăm tổng số tin. Lần chạy đầu đúng vì thế chỉ dựng được chuỗi cho một
# quận duy nhất, và chuỗi đó có 4 tuần.
#
# Ngưỡng thấp hơn là hợp lý chứ không phải nới tay: trong phạm vi một quận, hồi quy chỉ phải
# ước lượng vài chục hệ số thay vì vài trăm, nên cùng một mức tin cậy cần ít mẫu hơn nhiều.
MIN_WEEK_SAMPLE_DISTRICT = 150

# Tổng số tin tối thiểu của một quận để đáng dựng chỉ số riêng.
MIN_DISTRICT_SAMPLE = 4_000

# Đặc trưng dùng làm biến kiểm soát. Cố ý KHÔNG có 'published_month' — biến thời gian duy
# nhất trong mô hình phải là các biến giả tuần, nếu không chúng tranh nhau giải thích cùng
# một thứ và hệ số tuần mất ý nghĩa.
CONTROL_CAT = ["property_type", "province", "district", "ward", "house_direction"]
CONTROL_NUM = ["log_area", "bedroom_count", "bathroom_count", "floor_count", "frontage_width"]


def weekly_hedonic_index(
    df: pd.DataFrame, weeks: pd.Series, label: str, min_week: int = MIN_WEEK_SAMPLE
) -> list[dict] | None:
    """Dựng chỉ số hedonic theo tuần cho một tập dữ liệu.

    Trả về danh sách điểm chỉ số, hoặc None nếu không đủ dữ liệu.
    """
    counts = weeks.value_counts().sort_index()
    good = counts[counts >= min_week].index

    if len(good) < 4:
        print(f"  [{label}] chỉ có {len(good)} tuần đủ mẫu — bỏ qua.")
        return None

    keep = weeks.isin(good)
    df, weeks = df.loc[keep], weeks.loc[keep]

    X_raw = build_features(df)
    y = np.log(df["price"].to_numpy(dtype="float64"))

    # Biến kiểm soát phân loại. min_frequency gộp các hạng mục quá hiếm vào một nhóm "khác":
    # một quận có 3 tin sẽ sinh ra hệ số hoàn toàn do nhiễu quyết định.
    enc_cat = OneHotEncoder(handle_unknown="ignore", min_frequency=30, sparse_output=True)
    M_cat = enc_cat.fit_transform(X_raw[CONTROL_CAT].astype(str))

    # Biến kiểm soát số. Điền khuyết bằng trung vị và thêm cờ "đã thiếu": bản thân việc chủ
    # tin không khai số tầng cũng tương quan với loại bất động sản, nên vứt thông tin đó đi
    # là để mô hình quy nhầm phần biến động ấy sang biến giả tuần.
    num = X_raw[CONTROL_NUM].astype("float64")
    missing_flags = num.isna().astype("float64").to_numpy()
    num_filled = num.fillna(num.median()).to_numpy()
    M_num = sparse.csr_matrix(np.hstack([num_filled, missing_flags]))

    # Biến giả tuần — thứ ta thực sự muốn đo.
    week_order = sorted(good)
    week_index = {w: i for i, w in enumerate(week_order)}
    rows = np.arange(len(weeks))
    cols = weeks.map(week_index).to_numpy()
    M_week = sparse.csr_matrix(
        (np.ones(len(weeks)), (rows, cols)), shape=(len(weeks), len(week_order))
    )

    M = sparse.hstack([M_cat, M_num, M_week], format="csr")

    # Ridge với alpha nhỏ: cần phạt để ma trận thưa gần cộng tuyến không làm hệ số nổ tung,
    # nhưng phạt mạnh sẽ kéo chính các hệ số tuần về 0 và làm chỉ số phẳng một cách giả tạo.
    model = Ridge(alpha=1.0, fit_intercept=True, solver="sparse_cg")
    model.fit(M, y)

    n_control = M_cat.shape[1] + M_num.shape[1]
    deltas = model.coef_[n_control:]

    # Chuẩn hoá về tuần đầu = 100. Chỉ số là mức TƯƠNG ĐỐI, không phải giá tuyệt đối.
    base = deltas[0]
    points = []
    for w, d in zip(week_order, deltas):
        n = int(counts[w])
        points.append(
            {
                "week_start": str(w.start_time.date()),
                "index": round(float(np.exp(d - base) * 100.0), 2),
                "n": n,
                # Sai số chuẩn xấp xỉ của trung bình log-giá trong tuần, đổi sang phần trăm.
                # Không phải sai số chuẩn đầy đủ của hồi quy, nhưng đủ để người đọc thấy
                # tuần ít mẫu thì điểm đó lung lay tới mức nào.
                "moe_percent": round(float(1.96 * y.std() / np.sqrt(n) * 100.0), 2),
            }
        )

    return points


def naive_median_index(df: pd.DataFrame, weeks: pd.Series) -> list[dict]:
    """Chỉ số ngây thơ: trung vị giá mỗi m² từng tuần. Dựng ra để so sánh, không để dùng."""
    ppm2 = df["price"].to_numpy(dtype="float64") / df["area"].to_numpy(dtype="float64")
    tmp = pd.DataFrame({"week": weeks.to_numpy(), "ppm2": ppm2})
    tmp = tmp[np.isfinite(tmp["ppm2"])]

    med = tmp.groupby("week")["ppm2"].agg(["median", "size"]).sort_index()
    med = med[med["size"] >= MIN_WEEK_SAMPLE]
    if med.empty:
        return []

    base = med["median"].iloc[0]
    return [
        {
            "week_start": str(w.start_time.date()),
            "index": round(float(m / base * 100.0), 2),
            "n": int(n),
        }
        for w, (m, n) in med[["median", "size"]].iterrows()
    ]


def describe(points: list[dict], label: str) -> dict:
    """Tóm tắt một chuỗi chỉ số: biến động đầu–cuối và mức dao động."""
    vals = [p["index"] for p in points]
    change = vals[-1] - vals[0]
    volatility = float(np.std(np.diff(vals))) if len(vals) > 1 else 0.0
    print(
        f"  [{label}] {len(points)} tuần · đầu→cuối {vals[0]:.1f} → {vals[-1]:.1f} "
        f"({change:+.1f} điểm) · dao động tuần {volatility:.2f}"
    )
    return {"change_points": round(change, 2), "weekly_volatility": round(volatility, 2)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="prepared.parquet")
    ap.add_argument("--out", default="price_index.json")
    args = ap.parse_args()

    path = DATA_DIR / args.data
    if not path.exists():
        sys.exit(f"Chưa có {path}. Chạy `python -m training.prepare_data` trước.")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Nạp {path} …")
    df = pd.read_parquet(path)
    ts = parse_published(df["published_at"])
    df = df.loc[ts.notna()].copy()
    ts = ts.loc[df.index]
    weeks = ts.dt.tz_convert(None).dt.to_period("W")

    print(f"  {len(df):,} dòng · {weeks.nunique()} tuần "
          f"({weeks.min().start_time.date()} → {weeks.max().end_time.date()})\n")

    print("=" * 78)
    print("NHIỆM VỤ 3.1 — CHỈ SỐ GIÁ TOÀN QUỐC THEO TUẦN")
    print("=" * 78)

    national = weekly_hedonic_index(df, weeks, "hedonic toàn quốc")
    if national is None:
        sys.exit("Không đủ tuần có mẫu để dựng chỉ số.")

    naive = naive_median_index(df, weeks)

    stats_hedonic = describe(national, "hedonic")
    stats_naive = describe(naive, "trung vị thô")

    # Đây là con số đáng nói nhất của cả nhiệm vụ: khoảng cách giữa hai đường CHÍNH LÀ phần
    # biến động do thay đổi cơ cấu tin đăng, chứ không phải do giá thị trường đổi.
    aligned = {p["week_start"]: p["index"] for p in naive}
    gaps = [abs(p["index"] - aligned[p["week_start"]])
            for p in national if p["week_start"] in aligned]
    max_gap = max(gaps) if gaps else 0.0
    mean_gap = float(np.mean(gaps)) if gaps else 0.0

    print(f"\n  Chênh lệch hedonic vs trung vị thô: trung bình {mean_gap:.2f} điểm, "
          f"lớn nhất {max_gap:.2f} điểm.")
    print("  Toàn bộ chênh lệch đó là biến động do đổi cơ cấu tin đăng, không phải do giá.")

    print("\n" + "=" * 78)
    print("NHIỆM VỤ 3.2 — CHỈ SỐ THEO KHU VỰC")
    print("=" * 78)

    X_all = build_features(df)
    df = df.assign(_prov=X_all["province"], _dist=X_all["district"])

    sizes = df.groupby(["_prov", "_dist"]).size().sort_values(ascending=False)
    big = sizes[sizes >= MIN_DISTRICT_SAMPLE]
    print(f"{len(big)} quận có từ {MIN_DISTRICT_SAMPLE:,} tin trở lên.\n")

    districts: list[dict] = []
    for (prov, dist), n in big.head(20).items():
        sub = df[(df["_prov"] == prov) & (df["_dist"] == dist)]
        pts = weekly_hedonic_index(
            sub, weeks.loc[sub.index], f"{prov}/{dist}", min_week=MIN_WEEK_SAMPLE_DISTRICT
        )
        if pts is None:
            continue
        st = describe(pts, f"{prov}/{dist}")
        districts.append(
            {"province": prov, "district": dist, "n": int(n), "points": pts, **st}
        )

    payload = {
        "built_at": pd.Timestamp.utcnow().isoformat(),
        "method": "hedonic — hồi quy log(giá) trên đặc điểm bất động sản + biến giả tuần",
        "base_week": national[0]["week_start"],
        "rows": int(len(df)),
        "min_week_sample": MIN_WEEK_SAMPLE,
        "min_week_sample_district": MIN_WEEK_SAMPLE_DISTRICT,
        "national": {"points": national, **stats_hedonic},
        "naive_median": {"points": naive, **stats_naive},
        "mix_shift_gap": {"mean_points": round(mean_gap, 2), "max_points": round(max_gap, 2)},
        "districts": districts,
        "caveats": [
            "Dữ liệu chỉ trải 19 tuần (06–09/2025) nên KHÔNG mô hình hoá tính mùa vụ.",
            "Số tin từ tháng 9 giảm còn khoảng một phần tư so với tháng 6–8; đó là dấu vết "
            "thu thập dữ liệu, không phải tín hiệu thị trường.",
            "Chỉ số dựa trên giá RAO, không phải giá giao dịch.",
            f"Chỉ số toàn quốc chỉ tính các tuần có từ {MIN_WEEK_SAMPLE:,} tin trở lên; "
            f"chỉ số cấp quận dùng ngưỡng {MIN_WEEK_SAMPLE_DISTRICT} tin/tuần.",
        ],
    }

    out = MODEL_DIR / args.out
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nĐã ghi {out}")


if __name__ == "__main__":
    main()
