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

  /* Đối chiếu giá người dùng nhập với KHOẢNG của mô hình, không phải với điểm giữa.
   *
   * Bản trước so với điểm giữa rồi cảnh báo khi lệch ≥15%. Hai vấn đề:
   *
   * 1. Ngưỡng đó nằm DƯỚI sai số của chính mô hình. Sai số trung vị đo được là 17,4%, và
   *    chỉ 31% dự đoán rơi trong ±10%. Nói cách khác, phân nửa số lần cảnh báo bật lên là
   *    do mô hình sai chứ không phải người dùng sai. Cảnh báo sai nhiều lần thì người dùng
   *    học được cách bỏ qua nó, kể cả lần nó đúng.
   *
   * 2. Nó bỏ qua `confidence`, trong khi mô hình đã tự nói nó chắc chắn tới đâu: khoảng
   *    ±12% khi tin cậy cao, ±32% khi thấp. Lệch 20% là chuyện đáng nói ở trường hợp đầu
   *    và hoàn toàn bình thường ở trường hợp sau.
   *
   * Ở đây dùng đúng khoảng đó làm ngưỡng. Vượt ra ngoài khoảng mới nói, và nói mạnh hơn khi
   * vượt xa. Mô hình tự nhận độ tin cậy THẤP thì im lặng — nó đang nói rằng nó không biết,
   * và cảnh báo dựa trên một ước tính không đáng tin còn tệ hơn không cảnh báo. */
  const doLech = (() => {
    if (!r || currentPrice == null || currentPrice <= 0) return null;
    if (r.confidence === "thấp") return null;

    const ngoaiTren = currentPrice > r.priceHigh;
    const ngoaiDuoi = currentPrice < r.priceLow;
    if (!ngoaiTren && !ngoaiDuoi) return null;

    // Biên độ nửa khoảng — dùng làm đơn vị đo "vượt ra ngoài bao xa".
    const bien = Math.max(1, r.priceHigh - r.price);
    const vuot = ngoaiTren
      ? (currentPrice - r.priceHigh) / bien
      : (r.priceLow - currentPrice) / bien;

    return {
      huong: ngoaiTren ? ("cao" as const) : ("thap" as const),
      // Vượt thêm hơn một lần biên độ nữa = lệch đủ xa để nói mạnh.
      manh: vuot >= 1,
      phanTram: Math.abs(Math.round(((currentPrice - r.price) / r.price) * 100)),
    };
  })();

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

          {doLech && (
            <div
              className={`rounded-md border px-2.5 py-2 text-xs ${
                doLech.manh
                  ? "border-warning/40 bg-warning/10"
                  : "border-border bg-muted/40"
              }`}
            >
              <p className="inline-flex items-start gap-1.5 font-medium">
                {doLech.huong === "cao" ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning-foreground" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 mt-0.5 text-info" />
                )}
                <span>
                  Giá bạn nhập {doLech.huong === "cao" ? "cao hơn" : "thấp hơn"} ước tính{" "}
                  {doLech.phanTram}% — nằm ngoài khoảng tham khảo.
                </span>
              </p>
              {/* Nói hậu quả, không chỉ nói con số. Người đăng cần biết điều này ảnh hưởng
                  gì tới tin của họ thì mới có lý do để cân nhắc lại. */}
              <p className="mt-1 text-muted-foreground">
                {doLech.manh
                  ? doLech.huong === "cao"
                    ? "Lệch khá xa mặt bằng. Tin đặt giá cao hơn hẳn khu vực thường ít người liên hệ, và có thể bị trả về khi duyệt."
                    : "Thấp hơn hẳn mặt bằng. Nếu không cố ý thì nên kiểm lại đơn vị — nhầm triệu với nghìn là lỗi hay gặp."
                  : "Vẫn có thể hợp lý nếu căn nhà có điểm mô hình chưa biết. Nếu vậy, hãy nói rõ điểm đó trong phần mô tả."}
              </p>
            </div>
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
