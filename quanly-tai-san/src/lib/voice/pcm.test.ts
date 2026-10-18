import { expect, test } from "vitest";
import { floatToPcm16Base64, pcm16Base64ToFloat, rms, SPEECH_RMS } from "./pcm";

test("khứ hồi float → pcm16 → float sai số dưới một bậc lượng tử", () => {
  const x = new Float32Array([0, 0.5, -0.5, 0.25, -0.999]);
  const y = pcm16Base64ToFloat(floatToPcm16Base64(x));
  expect(y.length).toBe(x.length);
  for (let i = 0; i < x.length; i++) expect(Math.abs(y[i] - x[i])).toBeLessThan(1 / 32768 + 1e-6);
});

test("kẹp mẫu ngoài [-1, 1]", () =>
  expect(Array.from(pcm16Base64ToFloat(floatToPcm16Base64(new Float32Array([2, -2]))))).toEqual([
    32767 / 32768,
    -1,
  ]));

test("pcm16 là little-endian: -0,5 → 0xC000 → byte 00 C0", () =>
  expect(floatToPcm16Base64(new Float32Array([-0.5]))).toBe(btoa(String.fromCharCode(0x00, 0xc0))));

test("rms của im lặng là 0, của sóng vuông biên độ 1 là 1", () => {
  expect(rms(new Float32Array(160))).toBe(0);
  expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1);
});

test("ngưỡng tiếng nói nằm giữa im lặng và giọng nói bình thường", () => {
  expect(SPEECH_RMS).toBeGreaterThan(0);
  expect(SPEECH_RMS).toBeLessThan(0.1);
});
