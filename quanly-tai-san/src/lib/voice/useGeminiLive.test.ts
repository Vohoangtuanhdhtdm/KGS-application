// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Hook useGeminiLive với micro, âm thanh và Gemini giả: kiểm tra các cuộc đua giữa stop() và một
 * start() còn đang chờ — chỗ dễ để micro bật mãi hoặc để phiên cũ phá phiên mới.
 */

// ---- Giả lập ----
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
const deferred = <T>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

const fakeTrack = () => ({ stop: vi.fn(), readyState: "live" });
const fakeStream = () => {
  const t = fakeTrack();
  return { track: t, stream: { getTracks: () => [t] } };
};

interface FakeSession {
  close: ReturnType<typeof vi.fn>;
  sendClientContent: ReturnType<typeof vi.fn>;
  sendRealtimeInput: ReturnType<typeof vi.fn>;
  sendToolResponse: ReturnType<typeof vi.fn>;
  callbacks: {
    onmessage: (m: unknown) => void;
    onclose: (e: { code: number; reason: string }) => void;
    onerror: (e: unknown) => void;
  };
}
const sessions: FakeSession[] = [];
let connectGate: Deferred<void> | null = null;

vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    live = {
      connect: async (o: { callbacks: FakeSession["callbacks"] }) => {
        if (connectGate) await connectGate.promise;
        const s: FakeSession = {
          close: vi.fn(),
          sendClientContent: vi.fn(),
          sendRealtimeInput: vi.fn(),
          sendToolResponse: vi.fn(),
          callbacks: o.callbacks,
        };
        sessions.push(s);
        return s;
      },
    };
  },
}));

const sessionApi = vi.fn(async () => ({ token: "auth_tokens/x", model: "m", expiresAt: "" }));
vi.mock("@/lib/api/voice", () => ({
  voiceApi: { session: () => sessionApi(), status: async () => ({ enabled: true }) },
}));

const workletPorts: { onmessage: ((e: { data: Float32Array }) => void) | null }[] = [];
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: async () => {} };
  createMediaStreamSource = () => ({ connect: () => {} });
  createAnalyser = () => ({ fftSize: 512, connect: () => {}, getFloatTimeDomainData: () => {} });
  createBuffer = (_c: number, n: number) => ({ duration: n / 24000, copyToChannel: () => {} });
  createBufferSource = () => ({
    buffer: null,
    connect: () => {},
    start: () => {},
    stop: () => {},
    onended: null,
  });
  close = vi.fn(async () => {});
}
class FakeWorkletNode {
  port: { onmessage: ((e: { data: Float32Array }) => void) | null } = { onmessage: null };
  constructor() {
    workletPorts.push(this.port);
  }
}

// ---- Khung chạy hook ----
import { useGeminiLive } from "./useGeminiLive";
type Api = ReturnType<typeof useGeminiLive>;
let api: Api;
let root: Root;
const Harness = () => {
  api = useGeminiLive({ onToolCall: async () => ({ ok: true }) });
  return null;
};
const flush = () => act(async () => {});

let gum: Deferred<unknown>[];
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessions.length = 0;
  workletPorts.length = 0;
  connectGate = null;
  sessionApi.mockClear();
  gum = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () => {
        const d = deferred<unknown>();
        gum.push(d);
        return d.promise;
      },
    },
  });
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Harness)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dừng khi start() còn đang chờ", () => {
  test("dừng lúc đang hỏi quyền micro: micro được cấp sau đó phải tắt ngay, không xin phiên", async () => {
    await act(async () => void api.start());
    await act(async () => api.stop());
    const { stream, track } = fakeStream();
    await act(async () => gum[0].resolve(stream));
    await flush();
    expect(track.stop).toHaveBeenCalled();
    expect(sessionApi).not.toHaveBeenCalled();
    expect(api.state).toBe("idle");
  });

  test("dừng rồi bắt đầu lại khi lần đầu còn chờ: lần đầu không được chen vào phiên mới", async () => {
    await act(async () => void api.start());
    await act(async () => api.stop());
    await act(async () => void api.start());
    const first = fakeStream();
    await act(async () => gum[0].resolve(first.stream));
    const second = fakeStream();
    await act(async () => gum[1].resolve(second.stream));
    await flush();
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    expect(sessionApi).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveLength(1);
  });

  test("dừng lúc đang kết nối Gemini: phiên mở xong sau đó phải bị đóng", async () => {
    connectGate = deferred<void>();
    await act(async () => void api.start());
    await act(async () => gum[0].resolve(fakeStream().stream));
    await flush();
    await act(async () => api.stop());
    await act(async () => connectGate!.resolve());
    await flush();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].close).toHaveBeenCalled();
    expect(api.state).toBe("idle");
  });

  test("sự kiện đóng muộn của phiên cũ không làm hỏng phiên mới", async () => {
    await act(async () => void api.start());
    await act(async () => gum[0].resolve(fakeStream().stream));
    await flush();
    await act(async () => api.stop());
    await act(async () => void api.start());
    await act(async () => gum[1].resolve(fakeStream().stream));
    await flush();
    expect(sessions).toHaveLength(2);
    await act(async () => sessions[0].callbacks.onclose({ code: 1000, reason: "" }));
    expect(api.state).not.toBe("error");
    expect(api.error).toBeNull();
  });
});

describe("không kẹt ở trạng thái đang nghĩ", () => {
  test("lượt chỉ có tiếng ồn mà KiGi không trả lời: 10 giây sau về lại chạm để nói", async () => {
    await act(async () => void api.start());
    await act(async () => gum[0].resolve(fakeStream().stream));
    await flush();
    // KiGi chào xong.
    await act(async () =>
      sessions[0].callbacks.onmessage({ serverContent: { turnComplete: true } }),
    );
    expect(api.state).toBe("ready");
    vi.useFakeTimers();
    await act(async () => api.talk());
    const loud = new Float32Array(1600).fill(0.2);
    const quiet = new Float32Array(1600);
    await act(async () => workletPorts[0].onmessage!({ data: loud }));
    for (let i = 0; i < 13; i++) await act(async () => workletPorts[0].onmessage!({ data: quiet }));
    expect(api.state).toBe("thinking");
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(api.state).toBe("ready");
  });
});
