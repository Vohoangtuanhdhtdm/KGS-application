import { expect, test } from "vitest";
import { demandState } from "./demandState";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const s = (o: Partial<Parameters<typeof demandState>[0]>) =>
  ({
    discoverableByOwners: true,
    discoverableUntil: future,
    demandReview: 1,
    ...o,
  }) as Parameters<typeof demandState>[0];

test("đã duyệt, còn hạn → đang mở", () => expect(demandState(s({}))).toBe("open"));
test("chờ duyệt", () => expect(demandState(s({ demandReview: 2 }))).toBe("pending"));
test("bị từ chối", () => expect(demandState(s({ demandReview: 3 }))).toBe("rejected"));
test("tắt mà hạn đã qua → hết hạn", () =>
  expect(demandState(s({ discoverableByOwners: false, discoverableUntil: past }))).toBe("expired"));
test("tắt, không hạn → chỉ nhận báo tin mới", () =>
  expect(
    demandState(s({ discoverableByOwners: false, discoverableUntil: null, demandReview: 2 })),
  ).toBe("alerts"));
