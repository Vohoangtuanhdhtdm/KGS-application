import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assetsApi } from "@/lib/api/assets";
import { contractsApi } from "@/lib/api/contracts";
import { fetchPortfolioIncome } from "@/lib/asset-income";
import { getErrorMessage } from "@/lib/api/errors";
import { useViewportKind } from "@/hooks/useViewportKind";
import { AssetMapClient } from "@/components/map/AssetMapClient";
import { MapTopBar, type StatusFilter } from "@/components/dashboard/MapTopBar";
import { MapStatPanels } from "@/components/dashboard/MapStatPanels";
import { AssetListOverlay } from "@/components/dashboard/AssetListOverlay";
import { AssetDetailPanel } from "@/components/dashboard/AssetDetailPanel";
import { AssetDetailDialog } from "@/components/assets/AssetDetailDialog";
import { FeatureSheet } from "@/components/navigation/FeatureSheet";
import { findSheet, SHEET_KEYS } from "@/components/navigation/sheetRoutes";
import { Button } from "@/components/ui/button";
import { Building2, Plus, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/ban-do/")({
  // `?sheet=` mở tính năng phụ ĐÈ LÊN bản đồ mà không đổi route → bản đồ không unmount,
  // giữ nguyên vị trí/zoom; Back của trình duyệt bỏ param này nên tự đóng sheet.
  validateSearch: (s: Record<string, unknown>): { sheet?: string } =>
    typeof s.sheet === "string" && SHEET_KEYS.includes(s.sheet) ? { sheet: s.sheet } : {},
  head: () => ({ meta: [{ title: "Bản đồ tài sản — Quản Lý Tài Sản" }] }),
  component: AssetMapDashboard,
});

function AssetMapDashboard() {
  const viewportKind = useViewportKind();
  const navigate = useNavigate();
  const { sheet } = Route.useSearch();
  const activeSheet = findSheet(sheet);
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [listOpen, setListOpen] = useState(false);

  const q = useQuery({ queryKey: ["asset-map-pins"], queryFn: () => assetsApi.mapPins() });

  // Thu nhập theo tháng của cả danh mục — quyết định marker nào "thở" và sparkline.
  const incomeQ = useQuery({
    queryKey: ["portfolio-income"],
    queryFn: fetchPortfolioIncome,
    retry: 1,
  });

  const expiringQ = useQuery({
    queryKey: ["contracts-expiring", 30],
    queryFn: () => contractsApi.expiring(30),
    retry: 1,
  });

  // Chỉ cần con số tổng — lấy pageSize 1 cho nhẹ. Trước đây là 1 thẻ ở trang Tổng quan.
  const activeContractsQ = useQuery({
    queryKey: ["contracts", { status: 2, page: 1, pageSize: 1 }],
    queryFn: () => contractsApi.list({ status: 2, page: 1, pageSize: 1 }),
    retry: 1,
  });

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  const items = useMemo(() => q.data ?? [], [q.data]);

  // Trên màn nhỏ, bản đồ nền + lớp nổi là trải nghiệm tệ — mở thẳng chế độ Danh sách.
  // Chỉ áp một lần lúc xác định được viewport, sau đó tôn trọng thao tác của người dùng.
  const [mobileApplied, setMobileApplied] = useState(false);
  useEffect(() => {
    if (mobileApplied || viewportKind !== "mobile") return;
    setMobileApplied(true);
    setListOpen(true);
  }, [viewportKind, mobileApplied]);

  const countOf = useCallback(
    (v: StatusFilter) => (v === "all" ? items.length : items.filter((a) => a.status === v).length),
    [items],
  );

  // Bộ lọc/tìm kiếm áp cho marker trên bản đồ; overlay Danh sách luôn hiện đủ để còn
  // thấy được cả tài sản chưa có toạ độ.
  const mapItems = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return items.filter(
      (a) =>
        (status === "all" || a.status === status) && (!kw || a.name.toLowerCase().includes(kw)),
    );
  }, [items, search, status]);

  const selected = items.find((a) => a.id === selectedId) ?? null;
  const selectedHasNoLocation =
    selected != null && (selected.latitude == null || selected.longitude == null);
  const isEmpty = !q.isLoading && !q.isError && items.length === 0;

  const locateFromList = useCallback((id: string) => {
    setListOpen(false);
    setSelectedId(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* `z-0` tạo stacking context nhốt các pane Leaflet (z-index 400–700) lại bên trong;
          thiếu nó chúng leo vào stacking context cha và đè lên mọi lớp nổi. */}
      <div className="absolute inset-0 z-0">
        <AssetMapClient
          items={mapItems}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={handleHover}
          onSelect={handleSelect}
          onCloseSelection={closeDetail}
          onOpenDetail={setDetailAssetId}
          income={incomeQ.data ?? {}}
          rightInset={40}
        />
      </div>

      {/* Thanh nổi trên cùng — mỏng, không chiếm chỗ của bản đồ bên dưới */}
      <div className="absolute top-3 left-3 z-[870]">
        <MapTopBar
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          countOf={countOf}
          onOpenList={() => setListOpen(true)}
        />
      </div>

      {/* 3 lớp thông tin nhỏ, xếp dọc dưới thanh nổi */}
      {!isEmpty && (
        <div className="absolute top-20 left-3 z-10">
          <MapStatPanels
            items={items}
            income={incomeQ.data ?? {}}
            expiring={expiringQ.data ?? []}
            activeContracts={activeContractsQ.data?.totalCount ?? null}
            loading={q.isLoading}
          />
        </div>
      )}

      {/* Nút thêm tài sản.
          Đặt TRÊN thanh tab chứ không cùng hàng: thanh tab rộng ~352px căn giữa nên trên
          màn 375px nó chạm tận mép phải, nút ở góc dưới-phải cùng hàng sẽ đè lên.
          z-870 ngang thanh nổi trên cùng để lúc thẻ xem nhanh mở vẫn bấm được.
          Ẩn khi danh mục rỗng vì lúc đó đã có nút gọi hành động ở giữa màn hình. */}
      {!isEmpty && (
        <Link
          to="/tai-san/moi"
          aria-label="Thêm tài sản"
          className="fixed right-5 bottom-[104px] z-[870] flex items-center gap-2 rounded-full bg-[#1E2761] p-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:py-3 sm:pr-5 sm:pl-4"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline">Thêm tài sản</span>
        </Link>
      )}

      {q.isError && (
        <div className="map-panel absolute top-20 left-1/2 z-20 -translate-x-1/2 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {getErrorMessage(q.error, "Không tải được danh sách tài sản")}
          </p>
        </div>
      )}

      {isEmpty && (
        <div className="map-panel absolute top-1/2 left-1/2 z-20 w-[min(380px,calc(100%-2.5rem))] -translate-x-1/2 -translate-y-1/2 p-6 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Chưa có tài sản nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm tài sản đầu tiên để bắt đầu theo dõi danh mục của bạn.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/tai-san/moi">
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm tài sản
            </Link>
          </Button>
        </div>
      )}

      {/* Tài sản chưa có toạ độ không có marker để neo card "mở tại chỗ" — dùng panel
          chi tiết ở cột phải riêng cho trường hợp này. */}
      {selectedHasNoLocation && selectedId && (
        <div className="absolute top-3 right-3 bottom-3 z-[875] w-[340px] max-w-[calc(100%-1.5rem)]">
          <AssetDetailPanel
            assetId={selectedId}
            onClose={closeDetail}
            onOpenDetail={setDetailAssetId}
          />
        </div>
      )}

      {activeSheet && (
        <FeatureSheet
          title={activeSheet.title}
          onClose={() => navigate({ to: "/ban-do", search: {} })}
        >
          <activeSheet.Component embedded />
        </FeatureSheet>
      )}

      <AssetDetailDialog assetId={detailAssetId} onClose={() => setDetailAssetId(null)} />

      <AssetListOverlay
        open={listOpen}
        items={items}
        loading={q.isLoading}
        onClose={() => setListOpen(false)}
        onLocate={locateFromList}
        onOpenDetail={setDetailAssetId}
      />
    </div>
  );
}
