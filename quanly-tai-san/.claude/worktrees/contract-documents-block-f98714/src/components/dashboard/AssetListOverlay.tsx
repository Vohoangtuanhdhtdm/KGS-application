import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AssetMapItem } from "@/lib/api/assets";
import { ASSET_STATUS, ASSET_STATUS_CLASS, ASSET_TYPE } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Search, MapPinOff, Building2, MapPin } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface AssetListOverlayProps {
  open: boolean;
  items: AssetMapItem[];
  loading: boolean;
  onClose: () => void;
  /** Chọn 1 tài sản có toạ độ → đóng overlay và bay tới marker tương ứng. */
  onLocate: (id: string) => void;
  /** Mo dialog chi tiet ngay tai cho, khong roi ban do. */
  onOpenDetail: (id: string) => void;
}

/**
 * Danh sách đầy đủ dạng bảng, mở TOÀN MÀN HÌNH — cố ý không chia đôi bản đồ: bản đồ là
 * nhân vật chính, danh sách chỉ xuất hiện khi người dùng chủ động cần thao tác hàng loạt.
 */
export function AssetListOverlay({
  open,
  items,
  loading,
  onClose,
  onLocate,
  onOpenDetail,
}: AssetListOverlayProps) {
  const [q, setQ] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const kw = q.trim().toLowerCase();
  const shown = kw
    ? items.filter(
        (a) =>
          a.name.toLowerCase().includes(kw) || `${a.district} ${a.city}`.toLowerCase().includes(kw),
      )
    : items;

  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách tài sản"
      className="asset-list-overlay fixed inset-0 z-[880] flex flex-col bg-background"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <h2 className="text-sm font-semibold">Danh sách tài sản</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {loading ? "—" : `${shown.length}/${items.length}`}
        </span>
        <div className="relative ml-2 w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc theo tên, khu vực..."
            className="h-9 pl-9"
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-9 w-9"
          aria-label="Đóng danh sách"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Building2 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            Không có tài sản nào khớp bộ lọc.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-2 font-medium">Tên tài sản</th>
                <th className="px-2 py-2 font-medium">Khu vực</th>
                <th className="px-2 py-2 font-medium">Loại</th>
                <th className="px-2 py-2 font-medium">Trạng thái</th>
                <th className="px-2 py-2 text-right font-medium">Giá trị</th>
                <th className="w-40 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const noLocation = a.latitude == null || a.longitude == null;
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(a.id)}
                        className="cursor-pointer text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {a.name}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {[a.district, a.city].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{ASSET_TYPE[a.type]}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className={ASSET_STATUS_CLASS[a.status]}>
                        {ASSET_STATUS[a.status]}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {a.currentValue != null
                        ? formatCurrency(a.currentValue, { compact: true })
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {/* Tài sản chưa gắn toạ độ vẫn nằm trong danh sách này, kèm lối bổ
                          sung vị trí — nếu ẩn đi người dùng sẽ tưởng bị mất tài sản. */}
                      {noLocation ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <MapPinOff className="h-3 w-3 shrink-0" />
                          Chưa có vị trí
                          <Link
                            to="/tai-san/$id/sua"
                            params={{ id: a.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            Bổ sung
                          </Link>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => onLocate(a.id)}
                        >
                          <MapPin className="mr-1 h-3 w-3" />
                          Xem trên bản đồ
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
