import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MapPin, RotateCcw, Sparkles } from "lucide-react";
import { assistantApi, type AssistantResult } from "@/lib/api/assistant";
import { getErrorMessage } from "@/lib/api/errors";
import { describeDemand } from "@/lib/demandSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXAMPLES = [
  "Thuê căn hộ 2PN ở Quận 7 dưới 15 triệu, có nuôi mèo",
  "Mua đất nền 80–120m² có sổ ở Thủ Đức, khoảng 2 tỷ",
  "Thuê phòng trọ gần chợ Bến Thành dưới 5 triệu, yên tĩnh",
];

const MODE_LABEL: Record<string, string> = {
  walking: "đi bộ",
  cycling: "xe đạp",
  driving: "xe máy/ô tô",
};

/**
 * Trợ lý tìm nhà: gõ nhu cầu bằng một câu, trợ lý chuyển thành bộ lọc.
 *
 * Trợ lý KHÔNG trả lời thay danh sách: nó điền bộ lọc của chính trang này, và kết quả vẫn do
 * tìm kiếm thường trả về. Người dùng thấy rõ trợ lý hiểu thành những điều kiện nào ("Trợ lý
 * hiểu là…"), gỡ được từng điều kiện ở hàng chip bên dưới, và hỏi tiếp để điều chỉnh.
 */
export function AssistantBar({
  result,
  onResult,
  onReset,
}: {
  result: AssistantResult | null;
  onResult: (r: AssistantResult) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState("");
  // Câu gợi ý chỉ hiện khi đang gõ vào ô (và ô còn trống): ba dòng ví dụ luôn mở chiếm
  // khoảng 100px đầu danh sách — đúng chỗ người dùng đang muốn thấy kết quả.
  const [focused, setFocused] = useState(false);

  const ask = useMutation({
    mutationFn: (msg: string) => assistantApi.searchIntent(msg, result),
    onSuccess: (r) => {
      setText("");
      onResult(r);
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, "Trợ lý tạm thời không dùng được"), {
        description: "Bạn vẫn có thể lọc bằng tay ở nút Bộ lọc.",
      }),
  });

  const submit = (msg: string) => {
    const m = msg.trim();
    if (m.length < 2 || ask.isPending) return;
    ask.mutate(m);
  };

  const chips = result ? describeDemand(result.criteria) : [];

  return (
    <section
      aria-label="Trợ lý tìm nhà"
      className="space-y-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] p-2.5"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Chỉ đóng khi tiêu điểm rời KHỎI cả khối (bấm vào câu gợi ý không tính là rời).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          aria-label={result ? "Điều chỉnh yêu cầu" : "Mô tả nhà bạn cần"}
          placeholder={
            result
              ? "Điều chỉnh: “rẻ hơn chút”, “bỏ điều kiện thú cưng”, “đổi sang Quận 3”…"
              : "Mô tả nhà bạn cần, ví dụ: thuê căn hộ 2PN dưới 12 triệu gần chỗ làm ở Hàm Nghi"
          }
          className="h-9 bg-background"
        />
        <Button type="submit" size="sm" className="h-9 shrink-0" disabled={ask.isPending}>
          {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tìm"}
        </Button>
      </form>

      {!result && focused && !text && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={ask.isPending}
              onClick={() => {
                setText(ex);
                submit(ex);
              }}
              className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-2" aria-live="polite">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Trợ lý hiểu là:</span>
            {chips.length === 0 && !result.anchor && (
              <span className="text-xs text-muted-foreground">chưa có điều kiện cụ thể nào</span>
            )}
            {chips.map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {c}
              </Badge>
            ))}
            {result.anchor && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" />
                {result.anchor.travelMinutes
                  ? `≤ ${result.anchor.travelMinutes} phút ${MODE_LABEL[result.anchor.travelMode ?? "driving"]} tới ${result.anchor.text}`
                  : `Trong ${result.anchor.radiusKm ?? 3} km quanh ${result.anchor.text}`}
              </Badge>
            )}
            {result.preferences.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className="border-primary/40 font-normal text-primary"
              >
                ưu tiên: {p}
              </Badge>
            ))}
          </div>

          {result.unrecognized.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>Chưa áp dụng được: {result.unrecognized.join("; ")}.</span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              Điều kiện cứng lọc danh sách; mục “ưu tiên” chỉ đẩy tin phù hợp lên trước. Gỡ từng
              điều kiện ở hàng chip bên dưới.
            </span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Làm lại
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
