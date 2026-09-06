import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { valuationApi, type ValuationRequest } from "@/lib/api/valuation";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CONFIDENCE_TONE: Record<string, string> = {
  cao: "bg-success/15 text-success border-success/30",
  "trung bình": "bg-warning/20 text-warning-foreground border-warning/40",
  thấp: "bg-muted text-muted-foreground border-border",
};

interface Props {
  /** Dữ liệu hiện có trên biểu mẫu. */
  input: ValuationRequest | null;
  /** Giá người dùng đang nhập, để đối chiếu. null hoặc 0 nghĩa là chưa nhập. */
  currentPrice: number | null;
}

/**
 * Ô giá tham khảo cạnh trường giá bán.
 *
 * Ba nguyên tắc, và cả ba đều là chuyện nói thật:
 *
 * 1. **Không tự chạy.** Người dùng phải chủ động bấm. Một con số tự nhảy ra trong lúc họ
 *    đang gõ sẽ neo suy nghĩ của họ vào đó, kể cả khi họ biết rõ căn nhà hơn mô hình.
 * 2. **Không bao giờ chỉ một con số.** Luôn kèm khoảng và mức tin cậy — một con số trần
 *    trụi khiến người đọc mặc định coi nó chính xác tới từng đồng.
 * 3. **Nói rõ sai số của chính mô hình.** Dòng cuối ghi thẳng MdAPE đo được, thay vì để
 *    người dùng tự đoán con số này đáng tin tới đâu.
 *
 * Dịch vụ định giá không chạy thì cả ô này biến mất, không hiện lỗi: đây là gợi ý thêm,
 * không phải thứ cần cho việc đăng tin.
 */
export function PriceSuggestion({ input, currentPrice }: Props) {
  const info = useQuery({
    queryKey: ["valuation-model-info"],
    queryFn: valuationApi.modelInfo,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const estimate = useMutation({
    mutationFn: () => valuationApi.estimate(input!),
  });

  // Chưa biết dịch vụ có sống không, hoặc biết là không sống → không hiện gì.
  if (!info.data?.available) return null;

  const ready = input != null && input.area > 0 && !!input.city && !!input.district;
  const r = estimate.data;

  const diffPercent =
    r && currentPrice != null && currentPrice > 0
      ? ((currentPrice - r.price) / r.price) * 100
      : null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium inline-flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Giá tham khảo
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready || estimate.isPending}
          onClick={() => estimate.mutate()}
        >
          {estimate.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {r ? "Tính lại" : "Xem giá tham khảo"}
        </Button>
      </div>

      {!ready && (
        <p className="text-xs text-muted-foreground">
          Điền diện tích và địa chỉ (tỉnh/thành, quận/huyện) để xem mức giá thị trường của
          khu vực.
        </p>
      )}

      {estimate.isError && (
        <p className="text-xs text-muted-foreground">
          Chưa lấy được giá tham khảo. Bạn vẫn đăng tin bình thường.
        </p>
      )}

      {r && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-semibold">
              {formatCurrency(r.price, { compact: true })}
            </span>
            <span className="text-sm text-muted-foreground">
              ({formatCurrency(r.priceLow, { compact: true })} –{" "}
              {formatCurrency(r.priceHigh, { compact: true })})
            </span>
            <Badge
              variant="outline"
              className={`font-normal ${CONFIDENCE_TONE[r.confidence] ?? ""}`}
            >
              Độ tin cậy {r.confidence}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Khoảng {formatCurrency(r.pricePerM2, { compact: true })}/m².
            {r.areaMedianPricePerM2 != null && r.areaSampleSize > 0 && (
              <>
                {" "}Mặt bằng khu vực:{" "}
                {formatCurrency(r.areaMedianPricePerM2, { compact: true })}/m² (
                {r.areaSampleSize.toLocaleString("vi-VN")} tin).
              </>
            )}
          </p>

          {/* Chỉ nói khi lệch đáng kể. Nhắc người dùng về mức lệch 3% là nhiễu, và làm họ
              bỏ qua luôn cả những lần cảnh báo thật sự đáng nghe. */}
          {diffPercent != null && Math.abs(diffPercent) >= 15 && (
            <p className="text-xs inline-flex items-center gap-1.5">
              {diffPercent > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-warning-foreground" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-info" />
              )}
              Giá bạn nhập {diffPercent > 0 ? "cao hơn" : "thấp hơn"} ước tính{" "}
              {Math.abs(Math.round(diffPercent))}%.
            </p>
          )}

          {r.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}

          {info.data.mdape != null && (
            <p className="text-[11px] text-muted-foreground border-t pt-2">
              Ước tính từ mô hình học máy huấn luyện trên tin rao bán thực tế. Sai số điển
              hình khoảng {Math.round(info.data.mdape)}% — hãy dùng làm mốc tham khảo, không
              phải giá thẩm định.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
