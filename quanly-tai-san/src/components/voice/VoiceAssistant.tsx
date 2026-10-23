import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Handshake, Mic, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { assistantApi, type AssistantResult } from "@/lib/api/assistant";
import { listingsApi } from "@/lib/api/listings";
import { voiceApi } from "@/lib/api/voice";
import { saveHandoff } from "@/lib/voice/handoff";
import { runCapNhatNhuCau, type KiGiToolPayload } from "@/lib/voice/kigiTools";
import { useGeminiLive, type VoiceState } from "@/lib/voice/useGeminiLive";
import { KiGiMascot } from "./KiGiMascot";

const TALK_LABEL: Partial<Record<VoiceState, string>> = {
  ready: "Chạm để nói",
  listening: "Đang nghe… chạm để gửi",
  speaking: "Chạm để ngắt lời",
  thinking: "KiGi đang nghĩ…",
  connecting: "Đang kết nối…",
};

const supported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof AudioWorkletNode !== "undefined";

/**
 * KiGi trên Trang chủ: nói nhu cầu bằng giọng, KiGi hỏi bù điều còn thiếu và dựng bộ lọc.
 *
 * Mọi điều kiện đi qua đúng pipeline của trợ lý gõ tay (search-intent); KiGi chỉ là một lối vào
 * khác. Giọng nói hỏng ở khâu nào thì ô gõ bên cạnh vẫn dùng được — và thẻ điều kiện đã dựng
 * được vẫn giữ lại để xem kết quả.
 */
export function VoiceAssistant({ focusTyping }: { focusTyping: () => void }) {
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ["voice-status"],
    queryFn: voiceApi.status,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: supported(),
  });
  const last = useRef<AssistantResult | null>(null);
  const [payload, setPayload] = useState<KiGiToolPayload | null>(null);

  const openResults = () => {
    if (last.current) saveHandoff(last.current);
    voice.stop();
    void navigate({ to: "/tin-dang", search: { tro_ly: 1 } });
  };

  // Đăng đúng bộ lọc KiGi vừa dựng thành nhu cầu: sang trang Tìm nhà (áp bộ lọc như "Xem N căn")
  // rồi mở hộp Đăng nhu cầu ở đó — một hộp dùng chung, không dựng lại tiêu chí ở đây.
  const postDemand = () => {
    if (last.current) saveHandoff(last.current);
    voice.stop();
    void navigate({ to: "/tin-dang", search: { tro_ly: 1, dang_nhu_cau: 1 } });
  };

  const voice = useGeminiLive({
    onToolCall: async (name, args) => {
      if (name === "mo_ket_qua") {
        if (!last.current) return { loi: "Bạn chưa nói điều kiện nào" };
        openResults();
        return { ok: true };
      }
      const r = await runCapNhatNhuCau(String(args.mo_ta ?? ""), last.current, {
        searchIntent: assistantApi.searchIntent,
        count: (f) => listingsApi.search(f).then((p) => p.totalCount),
      });
      if ("loi" in r) return r;
      last.current = r.result;
      setPayload(r.payload);
      return r.payload as unknown as Record<string, unknown>;
    },
  });

  // Từ chối quyền micro: báo một lần và đưa người dùng về ô gõ.
  useEffect(() => {
    if (voice.error !== "mic-denied") return;
    toast.message("Bạn có thể gõ nhu cầu vào ô bên cạnh", {
      description: "KiGi cần quyền dùng micro để nghe bạn nói.",
    });
    focusTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.error]);

  if (!supported() || !status.data?.enabled) return null;

  const begin = async () => {
    last.current = null;
    setPayload(null);
    await voice.start();
  };

  const active = voice.state !== "idle" && voice.state !== "error";
  const busy = voice.state === "error" && voice.error !== "mic-denied";

  if (!active && !payload && !busy)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1">
        <Button type="button" variant="outline" className="h-10" onClick={() => void begin()}>
          <Mic className="mr-1.5 h-4 w-4" /> Nói với KiGi
        </Button>
        <span className="text-xs text-muted-foreground">
          Giọng nói được xử lý bởi Google Gemini
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-center">
      <KiGiMascot state={voice.state} level={voice.level} size={112} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm">
          <span className="font-medium text-primary">KiGi: </span>
          {busy
            ? "Trợ lý giọng nói đang bận — bạn gõ vào ô phía trên nhé."
            : voice.agentText || "…"}
        </p>
        {voice.userText && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Bạn: </span>
            {voice.userText}
          </p>
        )}
        {payload && payload.dieu_kien_da_hieu.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {payload.dieu_kien_da_hieu.map((d) => (
              <Badge key={d} variant="secondary" className="font-normal">
                {d}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {active && (
            <Button
              type="button"
              onClick={voice.talk}
              disabled={voice.state === "thinking" || voice.state === "connecting"}
              className="h-10"
            >
              <Mic className="mr-1.5 h-4 w-4" /> {TALK_LABEL[voice.state] ?? "Chạm để nói"}
            </Button>
          )}
          {payload && payload.so_can > 0 && (
            <Button type="button" variant="outline" className="h-10" onClick={openResults}>
              Xem {payload.uoc_tinh ? "khoảng " : ""}
              {payload.so_can} căn
            </Button>
          )}
          {payload && (
            <Button type="button" variant="outline" className="h-10" onClick={postDemand}>
              <Handshake className="mr-1.5 h-4 w-4 text-primary" /> Đăng nhu cầu này
            </Button>
          )}
          {active ? (
            <Button type="button" variant="ghost" className="h-10" onClick={voice.stop}>
              <PhoneOff className="mr-1.5 h-4 w-4" /> Kết thúc
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="h-10" onClick={() => void begin()}>
              <Mic className="mr-1.5 h-4 w-4" /> Nói lại với KiGi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
