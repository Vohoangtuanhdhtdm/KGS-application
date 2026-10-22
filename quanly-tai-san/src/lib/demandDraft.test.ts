import { expect, test } from "vitest";
import { DEMAND_DRAFT_KEY, saveDemandDraft, takeDemandDraft, type DemandDraft } from "./demandDraft";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const draft: DemandDraft = {
  name: "Phòng trọ Bình Thạnh dưới 5 triệu",
  criteria: { type: 2, district: "Quận Bình Thạnh", priceMax: 5_000_000, occupants: 2 },
  note: "Hai người đi làm",
  notify: true,
};

test("lưu rồi lấy ra đúng bản nháp, lấy lần hai thì không còn", () => {
  const s = new MemoryStorage();
  saveDemandDraft(draft, s);
  expect(takeDemandDraft(s)).toEqual(draft);
  expect(takeDemandDraft(s)).toBeNull();
});

test("JSON hỏng thì trả null và xoá khoá", () => {
  const s = new MemoryStorage();
  s.setItem(DEMAND_DRAFT_KEY, "{hỏng");
  expect(takeDemandDraft(s)).toBeNull();
  expect(s.getItem(DEMAND_DRAFT_KEY)).toBeNull();
});

test("thiếu tiêu chí thì không coi là bản nháp", () => {
  const s = new MemoryStorage();
  s.setItem(DEMAND_DRAFT_KEY, JSON.stringify({ name: "x", note: "", notify: true }));
  expect(takeDemandDraft(s)).toBeNull();
});

test("trình duyệt chặn bộ nhớ thì trả null, không ném lỗi", () => {
  const blocked = new MemoryStorage();
  blocked.getItem = () => {
    throw new Error("SecurityError");
  };
  blocked.setItem = () => {
    throw new Error("SecurityError");
  };
  expect(() => saveDemandDraft(draft, blocked)).not.toThrow();
  expect(takeDemandDraft(blocked)).toBeNull();
});
