"""Huấn luyện và đánh giá mô hình định giá (nhiệm vụ 2.3 + 2.4).

Chạy:
    python -m training.train

Kịch bản: nạp dữ liệu đã chuẩn bị → chia tập theo THỜI GIAN → huấn luyện ba mô hình nền và
một mô hình Gradient Boosting → đo cả bốn trên cùng một tập kiểm tra → ghi mô hình tốt nhất
kèm siêu dữ liệu.

CHIA TẬP THEO THỜI GIAN, KHÔNG PHẢI NGẪU NHIÊN. Đây là quyết định quan trọng nhất của tệp
này. Chia ngẫu nhiên cho phép mô hình nhìn thấy tin đăng tháng 6 khi dự đoán tin tháng 5 —
tức là biết trước tương lai. Độ đo thu được sẽ đẹp hơn thực tế và không bao giờ tái hiện
được khi triển khai, vì lúc đó mô hình chỉ có quá khứ. Chia theo mốc thời gian mô phỏng
đúng tình huống thật: học từ quá khứ, dự đoán cái chưa từng thấy.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training._console import setup as _console_setup  # noqa: E402

_console_setup()

import joblib  # noqa: E402
import lightgbm as lgb  # noqa: E402

from app.features import (  # noqa: E402
    CATEGORICAL,
    FEATURES,
    build_features,
    category_map,
    to_categorical,
)
from app.metrics import Scores, compare_table, evaluate  # noqa: E402
from app.timeparse import parse_published  # noqa: E402
from training.baselines import ALL_BASELINES  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"

# Tỉ lệ dữ liệu gần nhất giữ lại làm tập kiểm tra.
TEST_FRACTION = 0.15


def time_split(df: pd.DataFrame, frac: float = TEST_FRACTION) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Cắt theo mốc thời gian: phần cũ để học, phần mới nhất để kiểm tra."""
    ts = parse_published(df["published_at"])
    df = df.loc[ts.notna()].copy()
    ts = ts.loc[df.index]

    cutoff = ts.quantile(1.0 - frac)
    train = df.loc[ts <= cutoff]
    test = df.loc[ts > cutoff]

    print(f"Mốc chia: {cutoff}")
    print(f"  Huấn luyện: {len(train):,} dòng (tới {ts.loc[train.index].max()})")
    print(f"  Kiểm tra:   {len(test):,} dòng (từ {ts.loc[test.index].min()})")
    return train, test


def train_gbm(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_valid: pd.DataFrame,
    y_valid: np.ndarray,
) -> lgb.Booster:
    """Gradient Boosting trên log(giá).

    Vì sao LightGBM chứ không phải mạng nơ-ron: trên dữ liệu dạng bảng có nhiều đặc trưng
    phân loại và nhiều ô trống — đúng hình dạng của dữ liệu tin đăng — cây tăng cường gradient
    vẫn là thứ mạnh nhất, huấn luyện trong vài phút thay vì vài giờ, và quan trọng với một đồ
    án là nó giải thích được: mỗi dự đoán truy ngược về được đặc trưng nào đã đẩy giá lên xuống.

    LightGBM nhận trực tiếp đặc trưng phân loại và ô trống, không cần one-hot cũng không cần
    điền khuyết. Điền khuyết ở đây còn có hại: "không khai số tầng" là một thông tin thật về
    tin đăng, thay nó bằng giá trị trung vị là bịa ra dữ liệu không có.
    """
    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 96,
        "min_data_in_leaf": 40,
        "feature_fraction": 0.85,
        "bagging_fraction": 0.85,
        "bagging_freq": 1,
        "lambda_l2": 1.0,
        # Nhiều quận/phường chỉ có vài chục tin. Không siết thì cây tách hẳn một nhánh riêng
        # cho từng nhóm nhỏ đó và học thuộc lòng chúng.
        "cat_smooth": 20,
        "min_data_per_group": 50,
        "verbosity": -1,
        "seed": 42,
        "num_threads": 0,
    }

    ds_train = lgb.Dataset(X_train, label=y_train, categorical_feature=CATEGORICAL)
    ds_valid = lgb.Dataset(X_valid, label=y_valid, reference=ds_train)

    return lgb.train(
        params,
        ds_train,
        num_boost_round=3000,
        valid_sets=[ds_valid],
        valid_names=["valid"],
        # Dừng sớm: số vòng tối ưu phụ thuộc dữ liệu, cố định nó là hoặc thiếu hoặc thừa.
        callbacks=[lgb.early_stopping(100, verbose=False), lgb.log_evaluation(200)],
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="prepared.parquet")
    ap.add_argument("--out", default="avm")
    args = ap.parse_args()

    path = DATA_DIR / args.data
    if not path.exists():
        sys.exit(f"Chưa có {path}. Chạy `python -m training.prepare_data` trước.")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Nạp {path} …")
    df = pd.read_parquet(path)
    print(f"  {len(df):,} dòng\n")

    train_df, test_df = time_split(df)

    # Tách tiếp một phần cuối của tập huấn luyện làm tập kiểm định để dừng sớm. Dùng chính
    # tập kiểm tra cho việc này là tự rò rỉ: số vòng lặp khi đó được chọn dựa trên chính
    # dữ liệu dùng để báo cáo kết quả.
    n_valid = max(1, int(len(train_df) * 0.1))
    fit_df, valid_df = train_df.iloc[:-n_valid], train_df.iloc[-n_valid:]
    print(f"  Trong đó tách {len(valid_df):,} dòng cuối làm tập kiểm định (dừng sớm)\n")

    y_fit = fit_df["price"].to_numpy(dtype="float64")
    y_valid = valid_df["price"].to_numpy(dtype="float64")
    y_test = test_df["price"].to_numpy(dtype="float64")

    X_fit_raw = build_features(fit_df)
    X_valid_raw = build_features(valid_df)
    X_test_raw = build_features(test_df)

    results: dict[str, Scores] = {}

    # ---------- 2.3 · Các mô hình nền ----------
    print("=" * 78)
    print("NHIỆM VỤ 2.3 — MÔ HÌNH NỀN")
    print("=" * 78)
    for cls in ALL_BASELINES:
        t0 = time.time()
        model = cls().fit(X_fit_raw, y_fit)
        pred = model.predict(X_test_raw)
        s = evaluate(y_test, pred)
        results[cls.name] = s
        print(f"{cls.name}\n  {s.summary()}   ({time.time() - t0:.1f}s)\n")

    # ---------- 2.4 · Gradient Boosting ----------
    print("=" * 78)
    print("NHIỆM VỤ 2.4 — GRADIENT BOOSTING (LightGBM)")
    print("=" * 78)

    # Tập hạng mục lấy từ dữ liệu huấn luyện và được LƯU KÈM mô hình. Lúc phục vụ phải nạp
    # lại đúng tập này — xem ghi chú ở features.to_categorical.
    X_fit = to_categorical(X_fit_raw)
    cats = category_map(X_fit)
    X_valid = to_categorical(X_valid_raw, cats)
    X_test = to_categorical(X_test_raw, cats)

    t0 = time.time()
    booster = train_gbm(
        X_fit[FEATURES], np.log(y_fit),
        X_valid[FEATURES], np.log(y_valid),
    )
    train_secs = time.time() - t0

    pred_test = np.exp(booster.predict(X_test[FEATURES], num_iteration=booster.best_iteration))
    gbm_scores = evaluate(y_test, pred_test)
    results["Gradient Boosting (LightGBM)"] = gbm_scores

    print(f"\n  Số vòng tốt nhất: {booster.best_iteration}   ({train_secs:.1f}s)")
    print(f"  {gbm_scores.summary()}\n")

    print("Mức đóng góp của đặc trưng (theo độ lợi):")
    gains = pd.Series(
        booster.feature_importance("gain"), index=booster.feature_name()
    ).sort_values(ascending=False)
    total_gain = gains.sum()
    for name, g in gains.head(12).items():
        print(f"  {name:<20}{g / total_gain * 100:>6.1f}%")

    # ---------- So sánh ----------
    print("\n" + "=" * 78)
    print("SO SÁNH TRÊN CÙNG TẬP KIỂM TRA")
    print("=" * 78)
    print(compare_table(results))

    best_baseline = min(
        (s for name, s in results.items() if name != "Gradient Boosting (LightGBM)"),
        key=lambda s: s.mdape,
    )
    improvement = (best_baseline.mdape - gbm_scores.mdape) / best_baseline.mdape * 100
    print(
        f"\nGBM giảm MdAPE {improvement:.1f}% so với mô hình nền tốt nhất "
        f"({best_baseline.mdape:.2f}% → {gbm_scores.mdape:.2f}%)."
    )

    # ---------- Lưu ----------
    booster.save_model(str(MODEL_DIR / f"{args.out}.txt"), num_iteration=booster.best_iteration)

    # Bảng tra giá trung vị mỗi m² theo quận, tính TRÊN DỮ LIỆU HUẤN LUYỆN.
    #
    # Hai việc: cho người dùng một con số đối chiếu độc lập với mô hình, và cho dịch vụ biết
    # khu vực nào có đủ mẫu để tin — một quận chỉ có 5 tin thì dự đoán ở đó phải được đánh
    # dấu là kém tin cậy, chứ không im lặng trả về như mọi quận khác.
    fit_feat = X_fit_raw.copy()
    fit_feat["ppm2"] = y_fit / fit_feat["area"].to_numpy()
    fit_feat = fit_feat[np.isfinite(fit_feat["ppm2"])]

    area_stats = (
        fit_feat.groupby(["province", "district"], observed=True)["ppm2"]
        .agg(median_ppm2="median", n="size")
        .reset_index()
    )
    area_stats.to_parquet(MODEL_DIR / f"{args.out}.area_stats.parquet", index=False)
    print(f"Bảng giá khu vực: {len(area_stats):,} quận")
    joblib.dump(
        {
            "categories": cats,
            "features": FEATURES,
            "categorical": CATEGORICAL,
            "best_iteration": booster.best_iteration,
        },
        MODEL_DIR / f"{args.out}.meta.joblib",
    )

    report = {
        "trained_at": pd.Timestamp.utcnow().isoformat(),
        "rows_total": int(len(df)),
        "rows_fit": int(len(fit_df)),
        "rows_valid": int(len(valid_df)),
        "rows_test": int(len(test_df)),
        "split": "theo thời gian, 15% mới nhất làm tập kiểm tra",
        "train_seconds": round(train_secs, 1),
        "best_iteration": int(booster.best_iteration),
        "results": {name: s.as_dict() for name, s in results.items()},
        "feature_gain_percent": {
            k: round(v / total_gain * 100, 2) for k, v in gains.items()
        },
    }
    (MODEL_DIR / f"{args.out}.report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\nĐã ghi mô hình và báo cáo vào {MODEL_DIR}")


if __name__ == "__main__":
    main()
