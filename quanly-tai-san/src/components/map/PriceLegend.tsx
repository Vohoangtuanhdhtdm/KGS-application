import { Loader2 } from "lucide-react";
import type { PriceGridResult } from "@/lib/api/listings";
import { PRICE_COLORS, PRICE_UNRELIABLE, shortPerM2 } from "./priceLayer";

/**
 * Chú giải lớp giá/m²: năm mức màu kèm mốc giá, đơn vị theo loại tin, và nói rõ màu được so trên
 * những tin nào — để người xem không hiểu nhầm đây là giá đất nhà nước hay giá giao dịch thật.
 */
export function PriceLegend({
  grid,
  listingType,
  loading,
  error,
  compact = false,
}: {
  grid: PriceGridResult | null;
  listingType: 1 | 2 | null;
  loading: boolean;
  error: boolean;
  /** Điện thoại: một dải màu với hai mốc đầu-cuối — khung danh sách kéo lên sẽ che mất bản đầy đủ. */
  compact?: boolean;
}) {
  const unit = listingType === 2 ? "đồng/m²/tháng" : "đồng/m²";
  const b = grid?.breaks ?? [];
  const ranges =
    b.length === 4
      ? [
          `< ${shortPerM2(b[0])}`,
          `${shortPerM2(b[0])}–${shortPerM2(b[1])}`,
          `${shortPerM2(b[1])}–${shortPerM2(b[2])}`,
          `${shortPerM2(b[2])}–${shortPerM2(b[3])}`,
          `≥ ${shortPerM2(b[3])}`,
        ]
      : null;

  if (compact)
    return (
      <div className="flex items-center gap-1.5 rounded-md border bg-card/95 px-2 py-1 text-[10px] shadow-sm backdrop-blur tabular">
        <span className="font-semibold">{listingType === 2 ? "Thuê/m²" : "Bán/m²"}</span>
        {error ? (
          <span className="text-destructive">lỗi tải</span>
        ) : b.length === 4 ? (
          <>
            <span className="text-muted-foreground">{shortPerM2(b[0])}</span>
            <span className="flex">
              {PRICE_COLORS.map((c) => (
                <span key={c} className="h-2 w-3.5" style={{ background: c }} />
              ))}
            </span>
            <span className="text-muted-foreground">{shortPerM2(b[3])}</span>
          </>
        ) : grid ? (
          <span className="text-muted-foreground">ít tin</span>
        ) : null}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    );

  return (
    <div className="w-[214px] rounded-lg border bg-card/95 p-2.5 text-[11px] shadow-md backdrop-blur">
      <p className="flex items-center justify-between gap-2 font-semibold text-xs">
        <span>{listingType === 2 ? "Giá thuê trung vị / m²" : "Giá bán trung vị / m²"}</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </p>
      <p className="text-muted-foreground">Đơn vị: {unit}</p>

      {error ? (
        <p className="mt-1.5 text-destructive">Chưa tải được lớp giá — thử kéo bản đồ lại.</p>
      ) : ranges ? (
        <ul className="mt-1.5 space-y-0.5">
          {ranges.map((r, i) => (
            <li key={r} className="flex items-center gap-1.5 tabular">
              <span
                className="h-2.5 w-5 rounded-sm border border-black/10"
                style={{ background: PRICE_COLORS[i] }}
              />
              {r}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-5 rounded-sm border border-black/10"
              style={{ background: PRICE_UNRELIABLE }}
            />
            Ít tin, chưa đủ để tính
          </li>
        </ul>
      ) : grid ? (
        <p className="mt-1.5 text-muted-foreground">
          Quá ít tin có diện tích để chia mức giá — ô chỉ hiện số tin.
        </p>
      ) : null}

      {grid && (
        <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">
          {grid.totalInView} tin trong khung nhìn. Mức màu so trên {grid.totalMatched} tin khớp bộ
          lọc — giá chào trên tin đăng, không phải giá giao dịch. Bấm một ô để phóng tới.
        </p>
      )}
    </div>
  );
}
