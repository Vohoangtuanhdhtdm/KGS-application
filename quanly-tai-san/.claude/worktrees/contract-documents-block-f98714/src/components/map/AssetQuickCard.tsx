import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { AssetMapItem } from "@/lib/api/assets";
import { contractsApi } from "@/lib/api/contracts";
import { INCOME_MONTHS, type AssetIncomeSummary } from "@/lib/asset-income";
import { ASSET_STATUS, ASSET_STATUS_CLASS } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import { useCountUp } from "@/hooks/useCountUp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ImageIcon, ArrowRight, Wallet, UserRound } from "lucide-react";

export const QUICK_CARD_WIDTH = 300;

/** Đường mini cho thu nhập theo tháng — SVG polyline, không kéo thêm thư viện chart. */
function Sparkline({ values }: { values: number[] }) {
  const w = 104;
  const h = 26;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={`0,${h} ${pts.join(" ")} ${w},${h}`}
        fill="currentColor"
        className="text-success/15"
        stroke="none"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-success"
      />
    </svg>
  );
}

function monthsBetween(fromIso: string, to: Date): number {
  const f = new Date(fromIso);
  return Math.max(0, (to.getFullYear() - f.getFullYear()) * 12 + (to.getMonth() - f.getMonth()));
}

export interface AssetQuickCardProps {
  asset: AssetMapItem;
  income?: AssetIncomeSummary;
  onClose: () => void;
  /** Mở dialog chi tiết đầy đủ thay vì điều hướng sang trang. */
  onOpenDetail: (id: string) => void;
}

export function AssetQuickCard({ asset, income, onClose, onOpenDetail }: AssetQuickCardProps) {
  const contractsQ = useQuery({
    queryKey: ["contracts", { assetId: asset.id }],
    queryFn: () => contractsApi.list({ assetId: asset.id, pageSize: 50 }),
  });

  const active = (contractsQ.data?.items ?? []).find((c) => c.status === 2) ?? null;
  const value = useCountUp(asset.currentValue ?? 0);
  const avgIncome = useCountUp(income?.averageMonthlyIncome ?? 0);

  return (
    <div className="map-panel flex w-full flex-col overflow-hidden">
      <div className="relative">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden bg-muted">
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
          )}
        </div>
        <Badge
          variant="outline"
          className={`absolute top-2 left-2 backdrop-blur ${ASSET_STATUS_CLASS[asset.status]}`}
        >
          {ASSET_STATUS[asset.status]}
        </Badge>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thẻ tài sản"
          className="absolute top-2 right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-background/85 backdrop-blur transition-opacity hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-sm leading-snug font-semibold">{asset.name}</h3>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">
            {asset.currentValue != null ? formatCurrency(value, { compact: true }) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {[asset.district, asset.city].filter(Boolean).join(", ") || "—"}
          </div>
        </div>

        {/* Thu nhập: trình bày dạng đường mini thay vì bảng số */}
        {income && income.averageMonthlyIncome != null && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Wallet className="h-3 w-3" />
              Thu nhập {INCOME_MONTHS} tháng gần nhất
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <Sparkline values={income.monthly} />
              <div className="min-w-0">
                <div className="text-sm font-semibold tabular-nums">
                  {formatCurrency(avgIncome, { compact: true })}
                </div>
                <div className="text-[11px] text-muted-foreground">TB/tháng</div>
              </div>
            </div>
          </div>
        )}

        {/* Chỉ hiện khách thuê khi thật sự có hợp đồng đang hiệu lực */}
        {contractsQ.isLoading ? (
          <Skeleton className="h-9 w-full rounded-md" />
        ) : (
          active && (
            <div className="flex items-start gap-2 border-t pt-3">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{active.counterpartyName}</div>
                <div className="text-[11px] text-muted-foreground">
                  Đã ở {monthsBetween(active.startDate, new Date())} tháng
                </div>
              </div>
            </div>
          )
        )}

        {/* Mở dialog chi tiết ngay tại chỗ — không rời bản đồ */}
        <Button size="sm" className="w-full" onClick={() => onOpenDetail(asset.id)}>
          Xem chi tiết đầy đủ
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
