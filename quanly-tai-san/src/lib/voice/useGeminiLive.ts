import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { voiceApi } from "@/lib/api/voice";
import { ApiError } from "@/lib/auth/types";
import { floatToPcm16Base64, pcm16Base64ToFloat, rms, SPEECH_RMS } from "./pcm";

/**
 * Phiên nói chuyện với Gemini Live — micro, loa, trạng thái, lời gọi công cụ.
 *
 * Không biết gì về bất động sản: công cụ được truyền vào qua `onToolCall`.
 *
 * Lượt nói do trình duyệt đánh dấu ("chạm để nói"): bài thử cho thấy tự phát hiện lượt nói của
 * Gemini bỏ lỡ một số đoạn nói. Ngoài lượt nói, micro không gửi gì lên — tiếng ồn phòng hay tiếng
 * loa của chính KiGi không kích hoạt nhầm.
 */

export type VoiceState =
  "idle" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";
export type VoiceError = "mic-denied" | "unavailable" | "quota" | "network";

export interface UseGeminiLiveOptions {
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Thời lượng tối đa một phiên, giây. */
  maxSeconds?: number;
  /** Ở trạng thái "ready" quá ngần này giây thì KiGi chào tạm biệt và đóng phiên. */
  silenceSeconds?: number;
}

const END_OF_TURN_QUIET_MS = 1200;
const MAX_TURN_MS = 15_000;
const FRAME_MS = 100;

export function useGeminiLive(o: UseGeminiLiveOptions) {
  const maxSeconds = o.maxSeconds ?? 180;
  const silenceSeconds = o.silenceSeconds ?? 20;

  const [state, setStateRaw] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceError | null>(null);
  const [userText, setUserText] = useState("");
  const [agentText, setAgentText] = useState("");
  const [level, setLevel] = useState(0);

  const stateRef = useRef<VoiceState>("idle");
  const setState = (s: VoiceState) => {
    stateRef.current = s;
    setStateRaw(s);
  };
  const toolRef = useRef(o.onToolCall);
  toolRef.current = o.onToolCall;

  const r = useRef({
    session: null as Session | null,
    stream: null as MediaStream | null,
    micCtx: null as AudioContext | null,
    outCtx: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    playhead: 0,
    sources: new Set<AudioBufferSourceNode>(),
    turnActive: false,
    heardSpeech: false,
    quietMs: 0,
    turnStartedAt: 0,
    toolRunning: false,
    agentTurnOpen: false,
    closingAfterTurn: false,
    stopping: false,
    maxTimer: 0 as ReturnType<typeof setTimeout> | 0,
    silenceTimer: 0 as ReturnType<typeof setTimeout> | 0,
    raf: 0,
  });

  const clearSilence = () => {
    if (r.current.silenceTimer) clearTimeout(r.current.silenceTimer);
    r.current.silenceTimer = 0;
  };

  const stop = useCallback(() => {
    const c = r.current;
    c.stopping = true;
    if (c.maxTimer) clearTimeout(c.maxTimer);
    clearSilence();
    cancelAnimationFrame(c.raf);
    c.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* đã dừng */
      }
    });
    c.sources.clear();
    try {
      c.session?.close();
    } catch {
      /* đã đóng */
    }
    c.stream?.getTracks().forEach((t) => t.stop());
    void c.micCtx?.close().catch(() => {});
    void c.outCtx?.close().catch(() => {});
    Object.assign(c, {
      session: null,
      stream: null,
      micCtx: null,
      outCtx: null,
      analyser: null,
      turnActive: false,
      toolRunning: false,
      closingAfterTurn: false,
    });
    setLevel(0);
    if (stateRef.current !== "error") setState("idle");
  }, []);

  const fail = useCallback(
    (e: VoiceError) => {
      setError(e);
      setState("error");
      stop();
    },
    [stop],
  );

  /** Hết âm thanh đang phát, không chờ công cụ, không trong lượt nói → chờ người dùng chạm micro. */
  const settle = () => {
    const c = r.current;
    if (c.stopping || c.turnActive || c.toolRunning || c.sources.size > 0 || c.agentTurnOpen)
      return;
    if (c.closingAfterTurn) {
      stop();
      return;
    }
    setState("ready");
    setLevel(0);
    clearSilence();
    c.silenceTimer = setTimeout(() => {
      if (stateRef.current !== "ready") return;
      c.closingAfterTurn = true;
      c.session?.sendClientContent({
        turns: "(Người dùng im lặng. Hãy chào tạm biệt thật ngắn.)",
        turnComplete: true,
      });
    }, silenceSeconds * 1000);
  };

  const flushPlayback = () => {
    const c = r.current;
    c.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* đã dừng */
      }
    });
    c.sources.clear();
    c.playhead = 0;
  };

  const play = (b64: string) => {
    const c = r.current;
    if (!c.outCtx || !c.analyser) return;
    const samples = pcm16Base64ToFloat(b64);
    const buf = c.outCtx.createBuffer(1, samples.length, 24000);
    buf.copyToChannel(samples, 0);
    const src = c.outCtx.createBufferSource();
    src.buffer = buf;
    src.connect(c.analyser);
    const at = Math.max(c.playhead, c.outCtx.currentTime);
    src.start(at);
    c.playhead = at + buf.duration;
    c.sources.add(src);
    src.onended = () => {
      c.sources.delete(src);
      settle();
    };
    clearSilence();
    setState("speaking");
  };

  const endTurn = () => {
    const c = r.current;
    if (!c.turnActive) return;
    c.turnActive = false;
    setLevel(0);
    c.session?.sendRealtimeInput({ activityEnd: {} });
    if (c.heardSpeech) {
      // KiGi sắp trả lời lượt mới: xoá câu cũ để chữ không nối tiếp vào lời trước.
      c.agentTurnOpen = true;
      setAgentText("");
      setState("thinking");
    } else settle();
  };

  const onFrame = (frame: Float32Array) => {
    const c = r.current;
    if (!c.turnActive || !c.session) return;
    c.session.sendRealtimeInput({
      audio: { data: floatToPcm16Base64(frame), mimeType: "audio/pcm;rate=16000" },
    });
    const v = rms(frame);
    setLevel(Math.min(1, v * 8));
    if (v > SPEECH_RMS) {
      c.heardSpeech = true;
      c.quietMs = 0;
    } else if (c.heardSpeech) c.quietMs += FRAME_MS;
    const tooLong = performance.now() - c.turnStartedAt >= MAX_TURN_MS;
    if ((c.heardSpeech && c.quietMs >= END_OF_TURN_QUIET_MS) || tooLong) endTurn();
  };

  const onMessage = async (m: LiveServerMessage) => {
    const c = r.current;
    if (m.toolCall?.functionCalls?.length) {
      c.toolRunning = true;
      setState("thinking");
      for (const fc of m.toolCall.functionCalls) {
        let response: Record<string, unknown>;
        try {
          response = await toolRef.current(
            fc.name ?? "",
            (fc.args ?? {}) as Record<string, unknown>,
          );
        } catch {
          response = { loi: "Chưa xử lý được câu này" };
        }
        if (!c.session) return;
        c.session.sendToolResponse({
          functionResponses: [{ id: fc.id, name: fc.name, response }],
        });
      }
      c.toolRunning = false;
    }
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) flushPlayback();
    if (sc.inputTranscription?.text) setUserText((t) => t + sc.inputTranscription!.text);
    if (sc.outputTranscription?.text) {
      if (!c.agentTurnOpen) {
        c.agentTurnOpen = true;
        setAgentText("");
      }
      setAgentText((t) => t + sc.outputTranscription!.text);
    }
    for (const p of sc.modelTurn?.parts ?? []) {
      if (p.inlineData?.data) {
        c.agentTurnOpen = true;
        play(p.inlineData.data);
      }
    }
    if (sc.turnComplete) {
      c.agentTurnOpen = false;
      settle();
    }
  };

  const meter = () => {
    const c = r.current;
    if (c.analyser && stateRef.current === "speaking") {
      const buf = new Float32Array(c.analyser.fftSize);
      c.analyser.getFloatTimeDomainData(buf);
      setLevel(Math.min(1, rms(buf) * 6));
    }
    c.raf = requestAnimationFrame(meter);
  };

  const start = useCallback(async () => {
    if (stateRef.current !== "idle" && stateRef.current !== "error") return;
    const c = r.current;
    c.stopping = false;
    setError(null);
    setUserText("");
    setAgentText("");
    setState("connecting");

    try {
      c.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      fail("mic-denied");
      return;
    }

    let token: string;
    let model: string;
    try {
      ({ token, model } = await voiceApi.session());
    } catch (e) {
      fail(e instanceof ApiError && e.status === 429 ? "quota" : "unavailable");
      return;
    }
    if (c.stopping) return;

    try {
      c.micCtx = new AudioContext({ sampleRate: 16000 });
      await c.micCtx.audioWorklet.addModule("/voice/mic-worklet.js");
      const node = new AudioWorkletNode(c.micCtx, "kgs-mic");
      node.port.onmessage = (e: MessageEvent<Float32Array>) => onFrame(e.data);
      c.micCtx.createMediaStreamSource(c.stream).connect(node);

      c.outCtx = new AudioContext({ sampleRate: 24000 });
      c.analyser = c.outCtx.createAnalyser();
      c.analyser.fftSize = 512;
      c.analyser.connect(c.outCtx.destination);
      c.playhead = 0;

      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1beta" } });
      c.session = await ai.live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (m) => void onMessage(m),
          onerror: () => {
            if (!c.stopping) fail("network");
          },
          onclose: (e) => {
            if (c.stopping) return;
            fail(e.code === 1011 && /quota|exhausted/i.test(e.reason) ? "quota" : "network");
          },
        },
      });
    } catch {
      fail("network");
      return;
    }
    if (c.stopping) return;

    c.maxTimer = setTimeout(stop, maxSeconds * 1000);
    c.raf = requestAnimationFrame(meter);
    c.agentTurnOpen = true;
    setState("thinking");
    c.session.sendClientContent({ turns: "(Bắt đầu phiên.)", turnComplete: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail, stop, maxSeconds]);

  /** Chạm micro: mở lượt nói (ngắt KiGi nếu đang nói); đang nghe thì kết thúc lượt. */
  const talk = useCallback(() => {
    const c = r.current;
    if (!c.session) return;
    if (c.turnActive) {
      endTurn();
      return;
    }
    if (stateRef.current === "speaking" || c.sources.size > 0) flushPlayback();
    clearSilence();
    c.agentTurnOpen = false;
    c.closingAfterTurn = false;
    c.turnActive = true;
    c.heardSpeech = false;
    c.quietMs = 0;
    c.turnStartedAt = performance.now();
    setUserText("");
    c.session.sendRealtimeInput({ activityStart: {} });
    setState("listening");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rời trang giữa phiên: tắt micro, đóng kết nối, dừng âm thanh.
  useEffect(() => stop, [stop]);

  return { state, error, userText, agentText, level, start, talk, stop };
}
