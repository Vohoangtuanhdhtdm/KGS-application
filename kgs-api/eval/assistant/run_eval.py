"""Đánh giá trợ lý tìm nhà: độ chính xác khi dịch câu tiếng Việt thành bộ lọc.

Chạy (API đang chạy ở chế độ Development, giới hạn tần suất trợ lý nới rộng):
    python run_eval.py --api https://localhost:7230 --models openai/gpt-oss-120b qwen/qwen3.8-27b

Đo TOÀN BỘ đường đi thật (POST /api/assistant/search-intent): prompt + Groq + tầng kiểm tra
lại phía máy chủ — không đo riêng mô hình, vì người dùng nhận kết quả sau tầng kiểm tra.

Chỉ số:
  - Khớp hoàn toàn: mọi điều kiện cứng đúng VÀ không bịa thêm điều kiện nào.
  - Theo trường: precision (điều kiện trả về có đúng không) và recall (điều kiện người dùng
    nói có được hiểu không). Bịa điều kiện (precision thấp) nguy hiểm hơn bỏ sót: nó âm thầm
    loại những căn phù hợp.
  - Mong muốn mềm: tỉ lệ mong muốn kỳ vọng được nhận ra.
  - Điểm neo: có/không, thời gian, cách đi, bán kính.
  - Độ trễ (do API báo, chỉ tính lượt gọi Groq) và số token.
"""

from __future__ import annotations

import argparse
import json
import ssl
import statistics
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CTX = ssl._create_unverified_context()   # chứng chỉ dev tự ký của localhost

NUM = ["priceMin", "priceMax", "totalCostMax", "areaMin", "areaMax",
       "bedroomsMin", "bathroomsMin", "floorsMin", "frontageMin"]
SETS = ["propertyTypes", "directions", "legalStatuses", "furnitureStates", "amenities"]
SCALAR = ["type", "district", "petsAllowed", "curfewFree", "sharedWithOwner", "availableBy"]
FIELDS = SCALAR + NUM + SETS


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower().replace("đ", "d"))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


def call(api: str, model: str, body: dict) -> dict:
    url = f"{api}/api/assistant/search-intent?model={urllib.parse.quote(model)}"
    for attempt in range(8):
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # 503 = Groq từ chối (thường là hết hạn mức token/phút) → chờ rồi thử lại.
            if e.code in (429, 503) and attempt < 7:
                time.sleep(15 + attempt * 10)
                continue
            return {"error": f"HTTP {e.code}"}
        except Exception as e:  # noqa: BLE001
            return {"error": str(e)}
    return {"error": "hết lượt thử"}


def value(c: dict, k: str):
    v = c.get(k)
    if k == "availableBy" and v:
        return v[:10]
    if k in SETS:
        return sorted(v or [], key=str) or None
    return v


def same(k: str, exp, got, tol: float) -> bool:
    if exp is None or got is None:
        return exp is None and got is None
    if k in NUM:
        return abs(float(got) - float(exp)) <= tol * abs(float(exp)) + 1e-9
    if k in SETS:
        return sorted(map(str, exp)) == sorted(map(str, got))
    if k == "district":
        return norm(str(exp)) == norm(str(got))
    return exp == got


def score_case(case: dict, res: dict) -> dict:
    out = {"id": case["id"], "q": case["q"], "error": res.get("error")}
    if "error" in res:
        return out
    crit = res["criteria"]
    tol_map = case.get("tolerance", {})
    fields = {}
    for k in FIELDS:
        exp = case["expect"].get(k)
        if k in SETS and exp is not None:
            exp = sorted(exp, key=str)
        got = value(crit, k)
        tol = tol_map.get(k, 0.03)
        fields[k] = {"exp": exp, "got": got, "ok": same(k, exp, got, tol)}
    out["fields"] = fields
    out["exact"] = all(f["ok"] for f in fields.values())

    want = case.get("prefs", [])
    got_p = [norm(p) for p in res.get("preferences", [])]
    hit = sum(1 for w in want if any(norm(w) in g or g in norm(w) for g in got_p))
    out["prefs"] = (hit, len(want))

    exp_a = case.get("anchor")
    a = res.get("anchor")
    if exp_a is None:
        out["anchor_ok"] = a is None
    else:
        out["anchor_ok"] = a is not None and all(
            (a.get(k) == v if not isinstance(v, float) else abs((a.get(k) or 0) - v) < 0.01)
            for k, v in exp_a.items())
    if case.get("unrecognized"):
        out["unrec_ok"] = len(res.get("unrecognized", [])) > 0
    out["latency"] = res.get("latencyMs")
    out["tokens"] = res.get("totalTokens")
    out["model_used"] = res.get("model")
    return out


def run_model(api: str, model: str, cases: list[dict], results: dict) -> None:
    by_id: dict[int, dict] = {}
    scored = []
    for case in cases:
        body = {"message": case["q"], "current": None, "currentPreferences": None, "currentAnchor": None}
        if "base" in case:
            base = by_id.get(case["base"])
            if not base or "error" in base:
                scored.append({"id": case["id"], "q": case["q"], "error": "câu gốc lỗi"})
                continue
            body.update(current=base["criteria"], currentPreferences=base["preferences"],
                        currentAnchor=base["anchor"])
        res = call(api, model, body)
        by_id[case["id"]] = res
        scored.append(score_case(case, res))
        print(f"[{model}] {case['id']:>2} {'OK ' if scored[-1].get('exact') else '-- '} {case['q'][:60]}",
              flush=True)
        time.sleep(1.5)   # nhẹ tay với hạn mức token/phút
    results[model] = scored


def summarize(model: str, rows: list[dict]) -> dict:
    ok = [r for r in rows if not r.get("error")]
    tp = fp = fn = 0
    for r in ok:
        for f in r["fields"].values():
            exp, got = f["exp"], f["got"]
            if exp is not None and f["ok"]:
                tp += 1
            elif exp is not None:
                fn += 1
                if got is not None:
                    fp += 1
            elif got is not None:
                fp += 1
    prefs_hit = sum(r["prefs"][0] for r in ok)
    prefs_all = sum(r["prefs"][1] for r in ok)
    lat = [r["latency"] for r in ok if r.get("latency")]
    tok = [r["tokens"] for r in ok if r.get("tokens")]
    unrec = [r["unrec_ok"] for r in ok if "unrec_ok" in r]
    return {
        "model": model,
        "n": len(rows),
        "errors": len(rows) - len(ok),
        "exact": sum(1 for r in ok if r["exact"]) / max(1, len(rows)),
        "precision": tp / max(1, tp + fp),
        "recall": tp / max(1, tp + fn),
        "prefs_recall": prefs_hit / max(1, prefs_all),
        "anchor_acc": sum(1 for r in ok if r["anchor_ok"]) / max(1, len(ok)),
        "unrec_acc": sum(unrec) / max(1, len(unrec)),
        "p50_ms": statistics.median(lat) if lat else None,
        "p95_ms": sorted(lat)[int(0.95 * (len(lat) - 1))] if lat else None,
        "avg_tokens": statistics.mean(tok) if tok else None,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="https://localhost:7230")
    ap.add_argument("--models", nargs="+", default=["openai/gpt-oss-120b"])
    args = ap.parse_args()

    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    results: dict[str, list] = {}
    # Mỗi mô hình có hạn mức riêng → chạy song song, mỗi mô hình một luồng.
    threads = [threading.Thread(target=run_model, args=(args.api, m, cases, results)) for m in args.models]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    summaries = [summarize(m, results[m]) for m in args.models]
    (HERE / "results.json").write_text(
        json.dumps({"summaries": summaries, "details": results}, ensure_ascii=False, indent=1),
        encoding="utf-8")

    lines = [
        "# Đánh giá trợ lý tìm nhà",
        "",
        f"{len(cases)} câu hỏi (cases.json). Đo toàn bộ đường đi: prompt → Groq → tầng kiểm tra phía máy chủ.",
        "",
        "| Mô hình | Khớp hoàn toàn | Precision | Recall | Mong muốn mềm | Điểm neo | Báo khu vực lạ | p50 | p95 | Token TB | Lỗi |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for s in summaries:
        lines.append(
            f"| `{s['model']}` | {s['exact']:.0%} | {s['precision']:.0%} | {s['recall']:.0%} | "
            f"{s['prefs_recall']:.0%} | {s['anchor_acc']:.0%} | {s['unrec_acc']:.0%} | "
            f"{s['p50_ms'] or 0:.0f} ms | {s['p95_ms'] or 0:.0f} ms | {s['avg_tokens'] or 0:.0f} | {s['errors']} |")
    lines += ["", "## Các câu chưa khớp hoàn toàn", ""]
    for m in args.models:
        for r in results[m]:
            if r.get("error"):
                lines.append(f"- `{m}` #{r['id']} lỗi: {r['error']}")
            elif not r["exact"]:
                bad = [f"{k}: kỳ vọng {f['exp']} – nhận {f['got']}" for k, f in r["fields"].items() if not f["ok"]]
                lines.append(f"- `{m}` #{r['id']} \"{r['q']}\" → " + "; ".join(bad))
    (HERE / "results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:6 + len(summaries)]))


if __name__ == "__main__":
    import urllib.parse  # noqa: F401  (dùng trong call)
    sys.exit(main())
