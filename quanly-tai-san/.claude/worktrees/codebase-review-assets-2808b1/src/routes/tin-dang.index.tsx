import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  propertiesApi,
  type PublicListingFilters,
  type PublicPropertySummaryDto,
} from "@/lib/api/properties";
import { getErrorMessage } from "@/lib/api/errors";
import { type ListingTypeCode } from "@/constants/enums";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PropertyListCard } from "@/components/public/PropertyListCard";
import { MobileListSheet } from "@/components/public/MobileListSheet";
import { PropertyMapClient } from "@/components/map/PropertyMapClient";
import type { PropertyMapPoint } from "@/components/map/PropertyMap";
import { useGeolocationOnce, type LatLng } from "@/hooks/useGeolocationOnce";
import { useViewportKind } from "@/hooks/useViewportKind";
import { geocodeAddress } from "@/lib/geocode";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Home,
  ChevronDown,
  List,
  Map as MapIcon,
  LocateFixed,
  RotateCcw,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/tin-dang/")({
  head: () => ({ meta: [{ title: "Tin đăng bất động sản — Marketplace" }] }),
  component: PublicListingsPage,
});

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]; // TP.HCM
const DEFAULT_RADIUS_METERS = 5000;

function PublicListingsPage() {
  const viewportKind = useViewportKind();

  const [type, setType] = useState<ListingTypeCode>(1);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [bedroomsMin, setBedroomsMin] = useState<number | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  // Đồng bộ hover 2 chiều Card <-> Marker + click marker cuộn tới card
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Callback ỔN ĐỊNH (deps rỗng) truyền cho PropertyListCard đã bọc React.memo — nếu tạo
  // closure mới mỗi render (như trước) thì memo vô nghĩa, toàn bộ danh sách vẫn re-render
  // mỗi khi hoveredId đổi thay vì chỉ card liên quan.
  const handleCardHover = useCallback((id: string) => setHoveredId(id), []);
  const handleCardLeave = useCallback(
    (id: string) => setHoveredId((cur) => (cur === id ? null : cur)),
    [],
  );

  // ---- Giai đoạn 2: vị trí + bán kính tìm kiếm ----
  const { status: geoStatus, position: userLocation } = useGeolocationOnce();
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number | null>(null);
  const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // GPS thành công lần đầu → dùng làm tâm tìm kiếm mặc định (chỉ 1 lần, không ghi đè nếu
  // người dùng đã tự đổi searchCenter trước khi GPS trả về kịp)
  const gpsAppliedRef = useRef(false);
  useEffect(() => {
    if (geoStatus === "granted" && userLocation && !gpsAppliedRef.current) {
      gpsAppliedRef.current = true;
      setSearchCenter(userLocation);
      setRadiusMeters(DEFAULT_RADIUS_METERS);
    }
  }, [geoStatus, userLocation]);

  // ---- Ô tìm khu vực (geocoding) — debounce 500ms ----
  const [addressQuery, setAddressQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  useEffect(() => {
    const q = addressQuery.trim();
    if (q.length < 3) return;
    const t = setTimeout(async () => {
      setGeocoding(true);
      try {
        const result = await geocodeAddress(q);
        if (result) {
          setSearchCenter({ lat: result.lat, lng: result.lng });
          setRadiusMeters(DEFAULT_RADIUS_METERS);
          setShowSearchAreaButton(false);
        }
      } catch {
        // Nominatim lỗi mạng/rate-limit — bỏ qua im lặng, không chặn UI
      } finally {
        setGeocoding(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [addressQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [keywordInput]);

  const filters: PublicListingFilters = {
    type,
    city: city.trim(),
    district: district.trim(),
    priceMin: priceMin ?? "",
    priceMax: priceMax ?? "",
    bedroomsMin: bedroomsMin ?? "",
    keyword,
    latitude: searchCenter?.lat ?? "",
    longitude: searchCenter?.lng ?? "",
    radiusMeters: searchCenter && radiusMeters ? radiusMeters : "",
    page,
    pageSize: 20,
  };

  const query = useQuery({
    queryKey: ["public-listings", filters],
    queryFn: () => propertiesApi.search(filters),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const data = query.data;
  const items = useMemo(() => data?.items ?? [], [data]);

  const mapPoints: PropertyMapPoint[] = useMemo(
    () =>
      items
        .filter(
          (p): p is PublicPropertySummaryDto & { latitude: number; longitude: number } =>
            p.latitude != null && p.longitude != null,
        )
        .map((p) => ({
          id: p.id,
          lat: p.latitude,
          lng: p.longitude,
          price: p.price,
          type: p.type,
          slug: p.slug,
          title: p.title,
          thumbnailUrl: p.thumbnailUrl,
          rentPaymentCycle: p.rentPaymentCycle,
        })),
    [items],
  );

  const handleMarkerClick = (id: string) => {
    const el = cardRefs.current[id];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId((cur) => (cur === id ? null : cur)), 1500);
    // Trên tablet/mobile, chuyển sang xem danh sách để thấy card vừa highlight
    if (viewportKind === "tablet") setTabletView("list");
    if (viewportKind === "mobile") setMobileSnap(0.5);
  };

  // Kéo pin / click map / dragend marker → đổi tâm tìm kiếm, tự tìm lại, ẩn nút "khu vực này"
  const handleSearchCenterChange = (c: LatLng) => {
    setSearchCenter(c);
    if (radiusMeters == null) setRadiusMeters(DEFAULT_RADIUS_METERS);
    setShowSearchAreaButton(false);
    setPage(1);
  };

  const handleSearchThisArea = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const bounds = map.getBounds();
    const newRadius = center.distanceTo(bounds.getNorthEast()); // Leaflet tính sẵn, không cần haversine tay
    setSearchCenter({ lat: center.lat, lng: center.lng });
    setRadiusMeters(newRadius);
    setShowSearchAreaButton(false);
    setPage(1);
  };

  // ---- Giai đoạn 3: state responsive ----
  const [tabletView, setTabletView] = useState<"list" | "map">("list");
  const [mobileSnap, setMobileSnap] = useState<number | string | null>(0.5);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const activeFilterCount = (city.trim() ? 1 : 0) + (district.trim() ? 1 : 0);

  // ---- Nội dung filter chips (dùng chung desktop/tablet/trong Sheet mobile) ----
  const filterChips = (
    <>
      <div className="inline-flex rounded-md border p-0.5">
        <Button
          size="sm"
          variant={type === 1 ? "default" : "ghost"}
          className="h-8 rounded-sm"
          onClick={() => {
            setType(1);
            setPage(1);
          }}
        >
          Bán
        </Button>
        <Button
          size="sm"
          variant={type === 2 ? "default" : "ghost"}
          className="h-8 rounded-sm"
          onClick={() => {
            setType(2);
            setPage(1);
          }}
        >
          Cho thuê
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            Khoảng giá
            {(priceMin != null || priceMax != null) && <span className="ml-1 text-primary">•</span>}
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Từ (VNĐ)</Label>
            <CurrencyInput
              value={priceMin}
              onChange={(v) => {
                setPriceMin(v);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Đến (VNĐ)</Label>
            <CurrencyInput
              value={priceMax}
              onChange={(v) => {
                setPriceMax(v);
                setPage(1);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            Phòng ngủ
            {bedroomsMin != null && <span className="ml-1 text-primary">•</span>}
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <Label className="text-xs">Tối thiểu</Label>
          <div className="flex gap-1.5 mt-1.5">
            {[null, 1, 2, 3, 4].map((n) => (
              <Button
                key={String(n)}
                size="sm"
                variant={bedroomsMin === n ? "default" : "outline"}
                className="h-8 flex-1 px-0"
                onClick={() => {
                  setBedroomsMin(n);
                  setPage(1);
                }}
              >
                {n == null ? "Tất cả" : `${n}+`}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            Thêm bộ lọc
            {activeFilterCount > 0 && (
              <span className="ml-1 text-primary">({activeFilterCount})</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Thành phố</Label>
            <Input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              placeholder="VD: TP. Hồ Chí Minh"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quận/Huyện</Label>
            <Input
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setPage(1);
              }}
              placeholder="VD: Quận 7"
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );

  const addressSearchBox = (className?: string) => (
    <div className={`relative ${className ?? ""}`}>
      <LocateFixed className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Tìm theo địa chỉ, quận, thành phố..."
        className="pl-9 pr-8 h-8"
        value={addressQuery}
        onChange={(e) => setAddressQuery(e.target.value)}
      />
      {geocoding && (
        <Loader2
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground"
          aria-label="Đang tìm địa chỉ..."
        />
      )}
    </div>
  );

  const keywordSearchBox = (className?: string) => (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Tìm theo tiêu đề, mô tả..."
        className="pl-9 h-8"
        value={keywordInput}
        onChange={(e) => setKeywordInput(e.target.value)}
      />
    </div>
  );

  // ---- Nội dung danh sách (dùng chung mọi breakpoint) ----
  const listContent = query.isLoading ? (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden py-0 gap-0">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  ) : query.isError ? (
    <Card className="p-8 text-center text-sm text-destructive space-y-3">
      <AlertTriangle className="h-8 w-8 mx-auto text-destructive/60" />
      <p>{getErrorMessage(query.error, "Không tải được danh sách tin đăng")}</p>
      <Button size="sm" variant="outline" onClick={() => query.refetch()}>
        Thử lại
      </Button>
    </Card>
  ) : items.length === 0 ? (
    <Card className="p-10 text-center text-sm text-muted-foreground space-y-1.5">
      <Home className="h-10 w-10 mx-auto text-muted-foreground/40 mb-1" />
      <p>Không tìm thấy tin đăng nào phù hợp với bộ lọc.</p>
      <p>Thử mở rộng bán kính tìm kiếm hoặc bỏ bớt bộ lọc.</p>
    </Card>
  ) : (
    // Fade nhẹ (không nhảy cóc) khi đổi filter mà đang refetch — vẫn giữ layout cũ, không
    // thay skeleton hoàn toàn để tránh "giật" bố cục
    <div
      className={`space-y-4 transition-opacity duration-200 ${
        query.isFetching ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((p) => (
          <PropertyListCard
            key={p.id}
            property={p}
            ref={(el) => {
              cardRefs.current[p.id] = el;
            }}
            hovered={hoveredId === p.id}
            highlighted={highlightedId === p.id}
            onHover={handleCardHover}
            onLeave={handleCardLeave}
          />
        ))}
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {data.page}/{data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );

  // ---- Bản đồ + nút "Tìm trong khu vực này" (dùng chung mọi breakpoint) ----
  const mapContent = (
    <div className="relative h-full w-full">
      {mapPoints.length === 0 && !query.isLoading && !searchCenter ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
          <div className="text-center space-y-1">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p>Không có tin đăng nào có toạ độ để hiện trên bản đồ.</p>
          </div>
        </div>
      ) : (
        <PropertyMapClient
          points={mapPoints}
          hoveredId={hoveredId}
          onHoverPoint={setHoveredId}
          onClickPoint={handleMarkerClick}
          defaultCenter={DEFAULT_CENTER}
          userLocation={userLocation}
          searchCenter={searchCenter}
          onSearchCenterChange={handleSearchCenterChange}
          radiusMeters={radiusMeters}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
          onShowSearchAreaButtonChange={setShowSearchAreaButton}
        />
      )}
      {showSearchAreaButton && (
        <Button
          size="sm"
          className="absolute top-3 left-1/2 -translate-x-1/2 shadow-lg z-[500]"
          onClick={handleSearchThisArea}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Tìm trong khu vực này
        </Button>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <PublicHeader />

      {/* ---- Desktop & Tablet: filter chips sticky ngay dưới header ---- */}
      {viewportKind !== "mobile" && (
        <div className="border-b bg-card/95 backdrop-blur px-4 py-2.5 flex flex-wrap items-center gap-2">
          {viewportKind === "tablet" && (
            <div className="inline-flex rounded-md border p-0.5 mr-1">
              <Button
                size="sm"
                variant={tabletView === "list" ? "default" : "ghost"}
                className="h-8 rounded-sm"
                onClick={() => setTabletView("list")}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Danh sách
              </Button>
              <Button
                size="sm"
                variant={tabletView === "map" ? "default" : "ghost"}
                className="h-8 rounded-sm"
                onClick={() => setTabletView("map")}
              >
                <MapIcon className="h-3.5 w-3.5 mr-1.5" />
                Bản đồ
              </Button>
            </div>
          )}
          {filterChips}
          {addressSearchBox("w-52")}
          {keywordSearchBox("flex-1 min-w-[180px] max-w-sm ml-auto")}
        </div>
      )}

      {/* ---- Mobile: filter/search dạng nổi phía trên bản đồ ---- */}
      {viewportKind === "mobile" && (
        <div className="absolute top-14 inset-x-0 z-30 px-3 pt-3 flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto shadow-md rounded-md">{addressSearchBox()}</div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="inline-flex rounded-md border bg-card p-0.5 shadow-md">
              <Button
                size="sm"
                variant={type === 1 ? "default" : "ghost"}
                className="h-8 rounded-sm"
                onClick={() => {
                  setType(1);
                  setPage(1);
                }}
              >
                Bán
              </Button>
              <Button
                size="sm"
                variant={type === 2 ? "default" : "ghost"}
                className="h-8 rounded-sm"
                onClick={() => {
                  setType(2);
                  setPage(1);
                }}
              >
                Cho thuê
              </Button>
            </div>
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 bg-card shadow-md">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Lọc
                  {activeFilterCount > 0 && (
                    <span className="ml-1 text-primary">({activeFilterCount})</span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Bộ lọc</SheetTitle>
                </SheetHeader>
                <div className="p-4 flex flex-col gap-3">
                  {keywordSearchBox()}
                  <div className="flex flex-wrap gap-2">{filterChips}</div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* ---- Desktop: split view List 40% / Map 60%, mỗi bên cuộn/cố định độc lập ---- */}
      {viewportKind === "desktop" && (
        <div className="flex-1 min-h-0 flex flex-row">
          <div className="w-2/5 overflow-y-auto p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {query.isLoading ? "Đang tải..." : `${data?.totalCount ?? 0} bất động sản`}
            </p>
            {listContent}
          </div>
          <div className="w-3/5 border-l">{mapContent}</div>
        </div>
      )}

      {/* ---- Tablet: toggle Danh sách/Bản đồ, giữ nguyên state khi chuyển (không unmount) ---- */}
      {viewportKind === "tablet" && (
        <div className="flex-1 min-h-0 relative">
          <div
            className={`absolute inset-0 overflow-y-auto p-4 space-y-4 ${tabletView === "list" ? "" : "invisible pointer-events-none"}`}
          >
            <p className="text-sm text-muted-foreground">
              {query.isLoading ? "Đang tải..." : `${data?.totalCount ?? 0} bất động sản`}
            </p>
            {listContent}
          </div>
          <div
            className={`absolute inset-0 ${tabletView === "map" ? "" : "invisible pointer-events-none"}`}
          >
            {mapContent}
          </div>
        </div>
      )}

      {/* ---- Mobile: bản đồ toàn màn hình + bottom sheet danh sách kéo 3 mức ---- */}
      {viewportKind === "mobile" && (
        <div className="flex-1 min-h-0 relative">
          {mapContent}
          <MobileListSheet
            totalCount={data?.totalCount ?? 0}
            activeSnap={mobileSnap}
            onActiveSnapChange={setMobileSnap}
          >
            <div className="space-y-3">{listContent}</div>
          </MobileListSheet>
        </div>
      )}
    </div>
  );
}
