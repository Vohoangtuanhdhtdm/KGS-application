import { describe, expect, test } from "vitest";
import type { AssistantResult } from "@/lib/api/assistant";
import type { PublicListingFilters } from "@/lib/api/listings";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";
import { describeDemand } from "@/lib/demandSummary";
import {
  buildToolPayload,
  criteriaToFilters,
  missingInfo,
  runCapNhatNhuCau,
  type KiGiDeps,
} from "./kigiTools";

const result = (
  criteria: SavedSearchCriteria,
  extra: Partial<AssistantResult> = {},
): AssistantResult => ({
  criteria,
  preferences: [],
  anchor: null,
  unrecognized: [],
  model: "test",
  latencyMs: 0,
  totalTokens: 0,
  ...extra,
});

describe("missingInfo", () => {
  test("thiếu hết thì trả đúng thứ tự ưu tiên", () =>
    expect(missingInfo({})).toEqual(["thuê hay mua", "khu vực", "ngân sách", "loại nhà"]));

  test("đủ thuê + quận + giá thì chỉ còn loại nhà", () =>
    expect(missingInfo({ type: 2, district: "Quận Bình Thạnh", priceMax: 4_000_000 })).toEqual([
      "loại nhà",
    ]));

  test("tổng chi phí cũng tính là ngân sách, toạ độ cũng tính là khu vực", () =>
    expect(missingInfo({ type: 2, latitude: 10.8, totalCostMax: 5e6, propertyTypes: [1] })).toEqual(
      [],
    ));
});

describe("criteriaToFilters", () => {
  test("bỏ null và mảng rỗng, đặt pageSize 1", () =>
    expect(
      criteriaToFilters({
        type: 2,
        district: null,
        priceMax: 4e6,
        amenities: [],
        petsAllowed: true,
      }),
    ).toEqual({ type: 2, priceMax: 4e6, petsAllowed: true, pageSize: 1 }));
});

describe("buildToolPayload", () => {
  test("điều kiện đã hiểu gồm mô tả bộ lọc và mong muốn mềm", () => {
    const r = result({ type: 2, district: "Quận Bình Thạnh" }, { preferences: ["yên tĩnh"] });
    const p = buildToolPayload(r, 14, null);
    expect(p.dieu_kien_da_hieu).toEqual([...describeDemand(r.criteria), "yên tĩnh"]);
    expect(p.so_can).toBe(14);
    expect(p.con_thieu).toEqual(["ngân sách", "loại nhà"]);
  });

  test("có điểm neo thời gian đi lại thì số căn là ước tính", () => {
    const anchor = { text: "Hàm Nghi", travelMinutes: 20, travelMode: "driving", radiusKm: null };
    expect(buildToolPayload(result({}, { anchor }), 5, null).uoc_tinh).toBe(true);
    expect(buildToolPayload(result({}), 5, null).uoc_tinh).toBe(false);
  });
});

describe("runCapNhatNhuCau", () => {
  const deps = (over: Partial<KiGiDeps> = {}): KiGiDeps => ({
    searchIntent: async () => result({ type: 2 }),
    count: async () => 3,
    ...over,
  });

  test("cộng dồn: lượt sau gửi kết quả lượt trước làm previous", async () => {
    const seen: (AssistantResult | null)[] = [];
    const d = deps({
      searchIntent: async (_m, prev) => {
        seen.push(prev);
        return result({ type: 2, district: prev ? "Quận 3" : null });
      },
    });
    const one = await runCapNhatNhuCau("thuê nhà", null, d);
    if ("loi" in one) throw new Error("không mong đợi lỗi");
    await runCapNhatNhuCau("ở quận 3", one.result, d);
    expect(seen).toEqual([null, one.result]);
  });

  test("0 căn thì gợi ý nới điều kiện đầu tiên có căn, kèm số đếm thật", async () => {
    const d = deps({
      searchIntent: async () => result({ type: 2, priceMax: 4e6, propertyTypes: [1] }),
      count: async (f: PublicListingFilters) => (f.priceMax == null ? 9 : 0),
    });
    const r = await runCapNhatNhuCau("dưới 4 triệu", null, d);
    if ("loi" in r) throw new Error("không mong đợi lỗi");
    expect(r.payload.so_can).toBe(0);
    expect(r.payload.goi_y_noi).toEqual({ bo: describeDemand({ priceMax: 4e6 })[0], so_can: 9 });
  });

  test("có căn thì không gợi ý nới", async () => {
    const r = await runCapNhatNhuCau("thuê", null, deps());
    if ("loi" in r) throw new Error("không mong đợi lỗi");
    expect(r.payload.goi_y_noi).toBeNull();
  });

  test("trợ lý lỗi (vd 429) thì trả loi, không ném", async () => {
    const r = await runCapNhatNhuCau(
      "thuê",
      null,
      deps({
        searchIntent: async () => {
          throw new Error("429");
        },
      }),
    );
    expect(r).toEqual({ loi: "Chưa xử lý được câu này" });
  });
});
