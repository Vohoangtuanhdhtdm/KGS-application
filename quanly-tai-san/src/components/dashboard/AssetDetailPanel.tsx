import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { assetsApi } from "@/lib/api/assets";
import { contractsApi } from "@/lib/api/contracts";
import { cashflowsApi } from "@/lib/api/cashflows";
import { getErrorMessage } from "@/lib/api/errors";
import {
  ASSET_STATUS,
  ASSET_STATUS_CLASS,
  ASSET_TYPE,
  CONTRACT_DIRECTION,
} from "@/constants/enums";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  ImageIcon,
  MapPin,
  ArrowRight,
  Megaphone,
  Wallet,
  FileText,
  MapPinOff,
} from "lucide-react";

/** Số tháng gần nhất tổng hợp thu/chi hiển thị trong panel. */
const CASHFLOW_MONTHS = 3;

export interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
  /** Mo dialog chi tiet day du tai cho — khong dieu huong roi ban do. */
  onOpenDetail?: (id: string) => void;
}

export function AssetDetailPanel({ assetId, onClose, onOpenDetail }: AssetDetailPanelProps) {
  const detailQ = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.detail(assetId),
  });

  const contractsQ = useQuery({
    queryKey: ["contracts", { assetId }],
    queryFn: () => contractsApi.list({ assetId, pageSize: 50 }),
  });

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - CASHFLOW_MONTHS);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const cashflowQ = useQuery({
    queryKey: ["cashflows", { assetId, months: CASHFLOW_MONTHS }],
    queryFn: () => cashflowsApi.list({ assetId, from: range.from, to: range.to, pageSize: 100 }),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const a = detailQ.data;
  const activeContracts = (contractsQ.data?.items ?? []).filter((c) => c.status === 2);
  const flows = cashflowQ.data?.items ?? [];
  const income = flows.filter((f) => f.direction === 1).reduce((s, f) => s + f.amount, 0);
  const expense = flows.filter((f) => f.direction === 2).reduce((s, f) => s + f.amount, 0);

  const address = a
    ? [a.address.detail, a.address.ward, a.address.district, a.address.city]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="map-panel map-panel-enter flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-2 p-5 pb-3">
        <h2 className="text-sm font-medium tracking-wide">Chi tiết tài sản</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết tài sản"
          className="shrink-0 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        {detailQ.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="aspect-[16/10] w-full rounded-lg" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : detailQ.isError || !a ? (
          <p className="py-8 text-center text-sm text-destructive">
            {getErrorMessage(detailQ.error, "Không tải được thông tin tài sản")}
          </p>
        ) : (
          <>
            <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
              {a.thumbnail?.url ? (
                <img src={a.thumbnail.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base leading-snug font-semibold">{a.name}</h3>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{address || "Chưa có địa chỉ"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Badge variant="outline" className={ASSET_STATUS_CLASS[a.status]}>
                  {ASSET_STATUS[a.status]}
                </Badge>
                <Badge variant="secondary">{ASSET_TYPE[a.type]}</Badge>
              </div>
              {a.location == null && (
                <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <MapPinOff className="h-3 w-3 shrink-0" />
                  Chưa có vị trí trên bản đồ
                </p>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-[11px] tracking-wide text-muted-foreground">
                Giá trị hiện tại
              </div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                {a.currentValue != null ? formatCurrency(a.currentValue) : "—"}
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Hợp đồng đang hiệu lực
                <span className="tabular-nums text-muted-foreground">
                  ({contractsQ.isLoading ? "—" : activeContracts.length})
                </span>
              </div>
              {contractsQ.isLoading ? (
                <Skeleton className="h-12 w-full rounded-md" />
              ) : activeContracts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Không có hợp đồng đang hiệu lực.</p>
              ) : (
                <ul className="space-y-1.5">
                  {activeContracts.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/hop-dong/$id"
                        params={{ id: c.id }}
                        className="block rounded-md border p-2.5 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">{c.counterpartyName}</span>
                          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px]">
                            {CONTRACT_DIRECTION[c.direction]}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {formatDate(c.startDate)} → {formatDate(c.endDate)}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">
                            {formatCurrency(c.rentAmount, { compact: true })}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                Thu chi {CASHFLOW_MONTHS} tháng gần nhất
              </div>
              {cashflowQ.isLoading ? (
                <Skeleton className="h-14 w-full rounded-md" />
              ) : cashflowQ.isError ? (
                <p className="text-xs text-muted-foreground">Không tải được số liệu thu chi.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-2.5">
                    <div className="text-[11px] text-muted-foreground">Thu</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-success">
                      {formatCurrency(income, { compact: true })}
                    </div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-[11px] text-muted-foreground">Chi</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-destructive">
                      {formatCurrency(expense, { compact: true })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <div className="shrink-0 space-y-1.5 border-t p-3">
        {onOpenDetail ? (
          <Button size="sm" className="w-full" onClick={() => onOpenDetail(assetId)}>
            Xem chi tiết đầy đủ
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="w-full" asChild>
            <Link to="/tai-san/$id" params={{ id: assetId }}>
              Xem chi tiết đầy đủ
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" asChild>
            <Link to="/tai-san/$id" params={{ id: assetId }} search={{ tab: "sale" }}>
              <Megaphone className="mr-1.5 h-3.5 w-3.5" />
              Đăng tin
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/thu-chi">
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Thu chi
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
