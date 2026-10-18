import { expect, test } from "vitest";
import type { AssistantResult } from "@/lib/api/assistant";
import { HANDOFF_KEY, saveHandoff, takeHandoff } from "./handoff";

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

const sample: AssistantResult = {
  criteria: { type: 2, district: "Quận Bình Thạnh", petsAllowed: true },
  preferences: ["yên tĩnh"],
  anchor: null,
  unrecognized: [],
  model: "test",
  latencyMs: 0,
  totalTokens: 0,
};

test("save rồi take trả đúng kết quả và xoá khoá", () => {
  const s = new MemoryStorage();
  saveHandoff(sample, s);
  expect(takeHandoff(s)).toEqual(sample);
  expect(s.getItem(HANDOFF_KEY)).toBeNull();
});

test("take khi không có khoá trả null", () => expect(takeHandoff(new MemoryStorage())).toBeNull());

test("take khi JSON hỏng trả null, không ném, và xoá khoá", () => {
  const s = new MemoryStorage();
  s.setItem(HANDOFF_KEY, "{hỏng");
  expect(takeHandoff(s)).toBeNull();
  expect(s.getItem(HANDOFF_KEY)).toBeNull();
});
