import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { assetsApi } from "@/lib/api/assets";
import { getErrorMessage } from "@/lib/api/errors";
import { ASSET_TYPE, OWNERSHIP_TYPE } from "@/constants/enums";
import { AssetStatusBadgeCode } from "@/components/EnumBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMediaTab } from "@/components/media/AssetMediaTab";
import { MarketplacePublishCard } from "@/components/assets/MarketplacePublishCard";
import { AssetUnitsTab } from "@/components/units/AssetUnitsTab";
import { AssetContractsTab } from "@/components/contracts/AssetContractsTab";
import { AssetDocumentsTab } from "@/components/assets/AssetDocumentsTab";
import { X, ImageIcon, MapPin, Pencil, ExternalLink, Ruler, Wallet, Calendar } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface AssetDetailDialogProps {
  assetId: string | null;
  onClose: () => void;
}

/**
 * Chi tiết tài sản đầy đủ dạng modal — mở từ nút "Xem chi tiết đầy đủ" của thẻ xem nhanh
 * trên bản đồ, KHÔNG điều hướng trang.
 *
 * Cố ý giữ ĐỦ cả 9 tab như trang /tai-san/$id (bản spec chỉ liệt kê 5 mục, sẽ mất
 * Tầng/Phòng, Thiết bị, Sửa chữa, Lịch sử sử dụng, Rao bán). Route /tai-san/$id vẫn được
 * giữ làm trang đầy đủ cho link từ trang khác và khi gõ URL trực tiếp.
 */
export function AssetDetailDialog({ assetId, onClose }: AssetDetailDialogProps) {
  const [tab, setTab] = useState("overview");
  const trapRef = useFocusTrap<HTMLDivElement>(!!assetId);

  const q = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.detail(assetId!),
    enabled: !!assetId,
  });

  useEffect(() => {
    if (!assetId) return;
    setTab("overview");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [assetId, onClose]);

  if (!assetId) return null;
  const a = q.data;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={a?.name ?? "Chi tiết tài sản"}
        className="animate-scale-in flex max-h-[88vh] w-full max-w-3xl flex-col rounded-[28px] bg-background shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4">
          <h2 className="truncate text-lg font-semibold">
            {q.isLoading ? "Đang tải..." : (a?.name ?? "Chi tiết tài sản")}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/tai-san/$id/sua" params={{ id: assetId }}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Sửa
              </Link>
            </Button>
            {/* Lối thoát sang trang đầy đủ — để chia sẻ link hoặc thao tác cần nhiều chỗ */}
            <Button size="sm" variant="ghost" asChild>
              <Link to="/tai-san/$id" params={{ id: assetId }}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Mở trang
              </Link>
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {q.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : q.isError || !a ? (
            <p className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(q.error, "Không tải được thông tin tài sản")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
                {a.thumbnail?.url ? (
                  <img src={a.thumbnail.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {[a.address.detail, a.address.ward, a.address.district, a.address.city]
                    .filter(Boolean)
                    .join(", ") || "Chưa có địa chỉ"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <AssetStatusBadgeCode code={a.status} />
                  <Badge variant="secondary">{OWNERSHIP_TYPE[a.ownershipType]}</Badge>
                  <Badge variant="outline">{ASSET_TYPE[a.type]}</Badge>
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="flex-wrap">
                  <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                  <TabsTrigger value="units">Tầng/Phòng ({a.unitCount})</TabsTrigger>
                  <TabsTrigger value="contracts">Hợp đồng ({a.activeContractCount})</TabsTrigger>
                  <TabsTrigger value="media">Ảnh</TabsTrigger>
                  <TabsTrigger value="listing">Tin đăng</TabsTrigger>
                  <TabsTrigger value="docs">Giấy tờ</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-2 pt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    Diện tích: <b>{a.area ? `${a.area} m²` : "—"}</b>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Giá trị hiện tại:{" "}
                    <b>{a.currentValue != null ? formatCurrency(a.currentValue) : "—"}</b>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {a.ownershipType === 2 ? "Ngày bắt đầu thuê" : "Ngày mua"}:{" "}
                    <b>{formatDate(a.acquisitionDate)}</b>
                  </div>
                  <p className="pt-2 whitespace-pre-wrap text-muted-foreground">{a.notes || "—"}</p>
                </TabsContent>

                <TabsContent value="units" className="pt-3">
                  <AssetUnitsTab assetId={assetId} />
                </TabsContent>
                <TabsContent value="contracts" className="pt-3">
                  <AssetContractsTab assetId={assetId} />
                </TabsContent>
                <TabsContent value="media" className="pt-3">
                  <AssetMediaTab assetId={assetId} />
                </TabsContent>
                <TabsContent value="listing" className="pt-3">
                  <MarketplacePublishCard assetId={assetId} />
                </TabsContent>
                <TabsContent value="docs" className="pt-3">
                  <AssetDocumentsTab assetId={assetId} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
