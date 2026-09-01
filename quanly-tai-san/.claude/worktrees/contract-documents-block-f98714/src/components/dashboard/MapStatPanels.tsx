import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AssetMapItem } from "@/lib/api/assets";
import type { ExpiringContract } from "@/lib/api/contracts";
import type { PortfolioIncome } from "@/lib/asset-income";
import { INCOME_MONTHS } from "@/lib/asset-income";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuickRenewDialog } from "@/components/contracts/QuickRenewDialog";
import { CONTRACT_DIRECTION } from "@/constants/enums";
import { Wallet, Home, Bell, X, LayoutPanelLeft, RefreshCw, ArrowRight } from "lucide-react";

/** Càng gần hết hạn càng gắt — giữ đúng thang màu vốn dùng ở trang Tổng quan cũ. */
function daysLeftClass(d: number): string {
  if (d <= 7) return "bg-destructive/15 text-destructive border-destructive/30";
  if (d <= 15) return "bg-warning/25 text-warning-foreground border-warning/40";
  return "bg-warning/10 text-warning-foreground border-warning/30";
}

const STORAGE_KEY = "ban-do:panels-hidden";

/**
 * RÀNG BUỘC CỨNG: panel không được cao quá 80px hay rộng quá 240px. Vượt ngưỡng này là
 * quay lại đúng lỗi "trông như dashboard cũ" đã bị phản hồi — đừng nới ra.
 */
const PANEL_W = 240;
const PANEL_MAX_H = 80;

type PanelId = "value" | "portfolio" | "alerts";

function loadHidden(): PanelId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PanelId[]) : [];
  } catch {
    return [];
  }
}

/** Sparkline 1 dòng, đủ nhỏ để nằm cùng hàng với con số. */
function MiniSpark({ values }: { values: number[] }) {
  const w = 68;
  const h = 20;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
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

function Shell({
  id,
  icon: Icon,
  title,
  onHide,
  children,
}: {
  id: PanelId;
  icon: React.ElementType;
  title: string;
  onHide: (id: PanelId) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="map-panel map-stat-panel px-3 py-2"
      style={{ width: PANEL_W, maxHeight: PANEL_MAX_H }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-[11px] tracking-wide text-muted-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={() => onHide(id)}
          aria-label={`Ẩn ${title}`}
          className="shrink-0 cursor-pointer rounded-sm text-muted-foreground/70 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export interface MapStatPanelsProps {
  items: AssetMapItem[];
  income: PortfolioIncome;
  expiring: ExpiringContract[];
  activeContracts: number | null;
  loading: boolean;
}

export function MapStatPanels({
  items,
  income,
  expiring,
  activeContracts,
  loading,
}: MapStatPanelsProps) {
  // Luôn khởi tạo rỗng để khớp SSR, đọc localStorage sau khi mount (tránh hydration mismatch)
  const [hidden, setHidden] = useState<PanelId[]>([]);
  useEffect(() => setHidden(loadHidden()), []);
  const [renewTarget, setRenewTarget] = useState<ExpiringContract | null>(null);

  const hide = (id: PanelId) => {
    const next = [...hidden, id];
    setHidden(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  const restoreAll = () => {
    setHidden([]);
    window.localStorage.setItem(STORAGE_KEY, "[]");
  };

  if (loading) return null;

  const totalValue = items.reduce((s, a) => s + (a.currentValue ?? 0), 0);
  const rented = items.filter((a) => a.status === 2).length;

  // Tổng thu nhập toàn danh mục theo từng tháng, để vẽ sparkline 1 dòng
  const monthly = Array.from({ length: INCOME_MONTHS }, (_, i) =>
    Object.values(income).reduce((s, v) => s + (v.monthly[i] ?? 0), 0),
  );
  const hasIncome = monthly.some((v) => v > 0);

  const visible = (["value", "portfolio", "alerts"] as PanelId[]).filter(
    (id) => !hidden.includes(id),
  );

  if (visible.length === 0) {
    return (
      <button
        type="button"
        onClick={restoreAll}
        aria-label="Hiện lại các panel thống kê"
        className="map-panel flex h-9 w-9 cursor-pointer items-center justify-center opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{ borderRadius: 9999 }}
      >
        <LayoutPanelLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!hidden.includes("value") && (
        <Shell id="value" icon={Wallet} title="Tổng giá trị" onHide={hide}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg leading-tight font-semibold tabular-nums">
              {formatCurrency(totalValue, { compact: true })}
            </span>
            {hasIncome && <MiniSpark values={monthly} />}
          </div>
        </Shell>
      )}

      {!hidden.includes("portfolio") && (
        <Shell id="portfolio" icon={Home} title="Danh mục" onHide={hide}>
          <div className="truncate text-sm font-medium tabular-nums">
            {items.length} tài sản
            <span className="text-muted-foreground"> · {rented} thuê</span>
          </div>
          {activeContracts != null && (
            <div className="truncate text-[11px] text-muted-foreground tabular-nums">
              {activeContracts} hợp đồng đang hiệu lực
            </div>
          )}
        </Shell>
      )}

      {!hidden.includes("alerts") && (
        <Shell id="alerts" icon={Bell} title="Cần chú ý" onHide={hide}>
          {expiring.length === 0 ? (
            <div className="text-sm text-muted-foreground">Không có cảnh báo</div>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer truncate text-left text-sm font-medium hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {expiring.length} hợp đồng sắp hết hạn
                </button>
              </PopoverTrigger>
              {/* Popover này thay hẳn khối "Hợp đồng sắp hết hạn" của trang Tổng quan cũ
                  nên phải giữ đủ: thang màu theo số ngày còn lại + gia hạn nhanh. */}
              <PopoverContent align="start" className="w-[360px] p-2">
                <ul className="max-h-[320px] space-y-1 overflow-y-auto">
                  {expiring.map((c) => (
                    <li key={c.id} className="rounded-md border p-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/hop-dong/$id"
                            params={{ id: c.id }}
                            className="block truncate text-xs font-medium hover:underline"
                          >
                            {c.assetName}
                            {c.assetUnitName && (
                              <span className="text-muted-foreground"> · {c.assetUnitName}</span>
                            )}
                          </Link>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {CONTRACT_DIRECTION[c.direction]} · {c.counterpartyName} · Hết hạn{" "}
                            {formatDate(c.endDate)}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 px-1.5 py-0 text-[11px] ${daysLeftClass(c.daysLeft)}`}
                        >
                          Còn {c.daysLeft} ngày
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setRenewTarget(c)}
                        >
                          <RefreshCw className="mr-1.5 h-3 w-3" />
                          Gia hạn
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/hop-dong"
                  className="mt-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                >
                  Xem tất cả hợp đồng
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </PopoverContent>
            </Popover>
          )}
        </Shell>
      )}

      <QuickRenewDialog target={renewTarget} onOpenChange={(v) => !v && setRenewTarget(null)} />
    </div>
  );
}
