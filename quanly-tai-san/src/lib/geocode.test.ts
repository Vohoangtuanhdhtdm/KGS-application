import { afterEach, describe, expect, test, vi } from "vitest";
import { geocodeForward, nameScore, resolveHit, splitQuery } from "./geocode";

vi.mock("./mapEngine", () => ({
  MAPBOX_TOKEN: "pk.test",
  distanceMeters: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.hypot(a.lat - b.lat, a.lng - b.lng) * 111_000,
}));

const PROX = { lat: 10.98, lng: 106.67 }; // gần Thủ Dầu Một

describe("splitQuery", () => {
  test("tách tên tỉnh cũ ra khỏi phần chính", () => {
    expect(splitQuery("Đại học Thủ Dầu Một, Bình Dương")).toEqual({
      head: "Đại học Thủ Dầu Một",
      context: ["Bình Dương"],
    });
  });

  test("bỏ quận/huyện, giữ số nhà và tên đường", () => {
    expect(splitQuery("45 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM")).toEqual({
      head: "45 Điện Biên Phủ",
      context: ["TP.HCM"],
    });
  });

  test("số nhà đứng riêng được ghép với tên đường phía sau", () => {
    expect(splitQuery("45, Điện Biên Phủ").head).toBe("45 Điện Biên Phủ");
  });

  test("không có dấu phẩy thì giữ nguyên", () => {
    expect(splitQuery("Chợ Bến Thành")).toEqual({ head: "Chợ Bến Thành", context: [] });
  });
});

describe("nameScore", () => {
  test("không phân biệt dấu và hoa thường", () => {
    expect(nameScore("dai hoc thu dau mot", "Trường Đại Học Thủ Dầu Một")).toBe(1);
  });
  test("khu vực trùng một phần tên thì điểm thấp", () => {
    expect(nameScore("Đại học Thủ Dầu Một", "Thu Dau Mot")).toBeLessThan(0.8);
  });
});

describe("geocodeForward", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(handlers: Record<string, unknown>) {
    const calls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const url = new URL(String(input));
        calls.push(url);
        const key = Object.keys(handlers).find((k) => url.pathname.includes(k));
        return new Response(JSON.stringify(key ? handlers[key] : {}), { status: 200 });
      }),
    );
    return calls;
  }

  test("v6 chỉ ra khu vực → gọi Search Box, đưa đúng trường đại học lên đầu", async () => {
    const calls = stubFetch({
      "/geocode/v6/": {
        features: [
          {
            id: "v6-1",
            geometry: { coordinates: [106.6538, 10.9807] },
            properties: { name: "Thu Dau Mot", place_formatted: "Thành phố Hồ Chí Minh" },
          },
        ],
      },
      "/searchbox/v1/suggest": {
        suggestions: [
          {
            mapbox_id: "a",
            name: "Bánh Mì Chảo Đại Học Thủ Dầu Một",
            full_address: "Hẻm",
            distance: 300,
          },
          {
            mapbox_id: "b",
            name: "Đại học Thủ Dầu Một",
            full_address: "06 Trần Văn Ơn",
            distance: 500,
          },
        ],
      },
    });

    const hits = await geocodeForward("Đại học Thủ Dầu Một, Bình Dương", PROX, undefined, "sess-1");

    expect(hits?.[0]).toMatchObject({ name: "Đại học Thủ Dầu Một", mapboxId: "b" });
    const suggest = calls.find((u) => u.pathname.includes("/suggest"))!;
    expect(suggest.searchParams.get("q")).toBe("Đại học Thủ Dầu Một");
    expect(suggest.searchParams.get("session_token")).toBe("sess-1");
    // Tên tỉnh cũ không bị gửi đi nữa — nó làm Mapbox trả kết quả rác.
    expect(calls.every((u) => !(u.searchParams.get("q") ?? "").includes("Bình Dương"))).toBe(true);
  });

  test("v6 đã khớp tên thì không tốn lượt Search Box", async () => {
    const calls = stubFetch({
      "/geocode/v6/": {
        features: [
          {
            id: "v6-1",
            geometry: { coordinates: [106.7, 10.8] },
            properties: { name: "Điện Biên Phủ", place_formatted: "Bình Thạnh" },
          },
        ],
      },
    });
    const hits = await geocodeForward("Điện Biên Phủ", PROX, undefined, "sess-1");
    expect(hits?.[0].name).toBe("Điện Biên Phủ");
    expect(calls.some((u) => u.pathname.includes("searchbox"))).toBe(false);
  });

  test("không có mã phiên thì không gọi Search Box", async () => {
    const calls = stubFetch({ "/geocode/v6/": { features: [] } });
    await geocodeForward("Đại học Thủ Dầu Một", PROX);
    expect(calls.some((u) => u.pathname.includes("searchbox"))).toBe(false);
  });

  test("resolveHit lấy toạ độ của gợi ý Search Box bằng retrieve cùng phiên", async () => {
    const calls = stubFetch({
      "/searchbox/v1/retrieve/b": {
        features: [{ geometry: { coordinates: [106.6754, 10.9806] } }],
      },
    });
    const at = await resolveHit({ id: "sb-b", name: "x", place: "", mapboxId: "b" }, "sess-1");
    expect(at).toEqual({ lat: 10.9806, lng: 106.6754 });
    expect(calls[0].searchParams.get("session_token")).toBe("sess-1");
  });
});
