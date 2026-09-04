import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type L from "leaflet";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listingsApi,
  type PublicListingFilters,
  LISTING_SORT,
  type ListingSortCode,
  type PublicListingSummaryDto,
} from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { type ListingTypeCode } from "@/constants/enums";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PropertyListCard } from "@/components/public/PropertyListCard";
import { MobileListSheet } from "@/components/public/MobileListSheet";
import { PropertyMapClient } from "@/components/map/PropertyMapClient";
import type { PropertyMapPoint } from "@/components/map/PropertyMap";
import { LocationSearchPopover } from "@/components/public/LocationSearchPopover";
import { SavedSearchesPopover } from "@/components/public/SavedSearchesPopover";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";
import { DemandSearchSheet, type DemandSearchResult } from "@/components/public/DemandSearchSheet";
import { useGeolocationOnDemand, type LatLng } from "@/hooks/useGeolocationOnDemand";
import { useViewportKind } from "@/hooks/useViewportKind";
import { geocodeAddress } from "@/lib/geocode";
import { formatCurrency } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Target,
  X,
  ArrowUpDown,
} from "lucide-react";

export const Route = createFileRoute("/tin-dang/")({
  head: () => ({ meta: [{ title: "Tin đăng bất động sản — Marketplace" }] }),
  component: PublicListingsPage,
});

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]; // TP.HCM
const DEFAULT_RADIUS_METERS = 5000;
const LIST_WIDTH_STORAGE_KEY = "tin-dang:list-width-percent";
const DEMAND_BANNER_DISMISSED_KEY = "tin-dang:demand-banner-dismissed";

/** "8,5 trieu" — chip loc phai doc luot duoc, khong phai dem so 0. */
const fmtShort = (v: number) => formatCurrency(v, { compact: true });

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
  const [sortBy, setSortBy] = useState<ListingSortCode>(1);

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

  // ---- Vị trí + bán kính tìm kiếm — chỉ xin quyền vị trí khi người dùng chủ động
  // bấm nút "Tìm quanh vị trí hiện tại", KHÔNG tự xin quyền khi vào trang. Mặc định
  // mở trang là xem toàn bộ tin đã duyệt, không lọc theo vị trí. ----
  const {
    status: geoStatus,
    position: userLocation,
    requestId,
    request: requestGeolocation,
  } = useGeolocationOnDemand();
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number | null>(null);
  const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const [myLocationRadiusKm, setMyLocationRadiusKm] = useState(5);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const [radiusInput, setRadiusInput] = useState("5");
  const pendingRadiusKmRef = useRef<number | null>(null);

  // Xử lý kết quả sau khi request() hoàn tất (được gọi từ nút "Tìm kiếm" trong popover) —
  // requestId chỉ đổi khi có kết quả mới (granted/denied), tránh xử lý trùng.
  useEffect(() => {
    if (requestId === 0 || pendingRadiusKmRef.current == null) return;
    const km = pendingRadiusKmRef.current;
    pendingRadiusKmRef.current = null;
    if (geoStatus === "granted" && userLocation) {
      setSearchCenter(userLocation);
      setRadiusMeters(km * 1000);
      setUsingMyLocation(true);
      setMyLocationRadiusKm(km);
      setShowSearchAreaButton(false);
      setRadiusPopoverOpen(false);
    } else if (geoStatus === "denied" || geoStatus === "unsupported") {
      toast.error(
        "Không thể lấy vị trí — vui lòng cho phép quyền truy cập vị trí trên trình duyệt, hoặc thử tìm theo địa chỉ cụ thể ở ô tìm kiếm.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Dùng chung cho cả popover "Tìm quanh vị trí hiện tại" lẫn lựa chọn "Gần vị trí hiện
  // tại" trong form "Tìm theo nhu cầu" — validate + xin quyền vị trí đúng 1 chỗ.
  const triggerLocationSearch = (km: number): boolean => {
    if (!Number.isFinite(km) || km < 0.5 || km > 50) {
      toast.error("Bán kính phải trong khoảng 0.5 – 50 km");
      return false;
    }
    pendingRadiusKmRef.current = km;
    requestGeolocation();
    return true;
  };

  const submitLocationSearch = () => {
    triggerLocationSearch(Number(radiusInput.replace(",", ".")));
  };

  const clearMyLocationSearch = () => {
    setSearchCenter(null);
    setRadiusMeters(null);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

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
          setUsingMyLocation(false);
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
    }, 400);
    return () => clearTimeout(t);
  }, [keywordInput]);

  // ---- Banner mời "Tìm theo nhu cầu" — luôn bắt đầu ẩn (khớp SSR, tránh hydration
  // mismatch), chỉ hiện sau khi mount nếu localStorage chưa đánh dấu đã đóng. ----
  const [showDemandBanner, setShowDemandBanner] = useState(false);
  const [demandSheetOpen, setDemandSheetOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DEMAND_BANNER_DISMISSED_KEY) === "1";
    if (!dismissed) setShowDemandBanner(true);
  }, []);

  const dismissDemandBanner = () => {
    setShowDemandBanner(false);
    window.localStorage.setItem(DEMAND_BANNER_DISMISSED_KEY, "1");
  };

  // Áp toàn bộ lựa chọn từ form "Tìm theo nhu cầu" vào bộ lọc hiện có — tái sử dụng
  // đúng state/logic sẵn có (ô địa chỉ, city/district, luồng xin quyền vị trí), không
  // viết trùng logic tìm kiếm.
  const handleDemandApply = (result: DemandSearchResult) => {
    setType(result.type);
    setPriceMin(result.priceMin);
    setPriceMax(result.priceMax);
    setBedroomsMin(result.bedroomsMin);
    if (result.location?.kind === "address") {
      setAddressQuery(result.location.query);
    } else if (result.location?.kind === "district") {
      setCity(result.location.city);
      setDistrict(result.location.district);
    } else if (result.location?.kind === "myLocation") {
      triggerLocationSearch(result.location.radiusKm);
    }
    setDemandSheetOpen(false);
  };

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
    sortBy,
    pageSize: 20,
  };

  // Phan trang vo han thay cho nut Trang truoc/Trang sau.
  //
  // Doi bo loc lam doi queryKey nen ket qua tu reset ve trang dau — khong con phai goi
  // setPage(1) rai rac o hang chuc cho, vốn là nguồn lỗi khi thêm bộ lọc mới mà quên.
  //
  // Bam vao mot tin roi quay lai: TanStack Query tra cache cho dung queryKey nen ca danh
  // sach da tai van con, khong bi keo ve dau trang.
  const query = useInfiniteQuery({
    queryKey: ["public-listings", filters],
    queryFn: ({ pageParam }) => listingsApi.search({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    retry: 1,
  });

  const pages = query.data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const items = useMemo(() => pages.flatMap((p) => p.items), [pages]);

  // Nap trang ke tiep khi cot moc duoi cuoi danh sach loṭ vao khung nhin.
  //
  // Dung callback ref chu khong phai useRef: trang render danh sach o ba nhanh
  // desktop/tablet/mobile loai tru nhau, nen node cot moc bi thao va dung lai moi khi
  // doi breakpoint. useRef khong bao cho ta biet dieu do, con callback ref thi co.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node || !hasNextPage) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // Chan goi chong: isFetchingNextPage van con true trong luc request bay,
          // ma cot moc thi chua kip bi day ra khoi khung nhin.
          if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
        },
        // Nap truoc khi con cach day mot man hinh — nguoi dung khong thay khoang trong.
        { rootMargin: "600px" },
      );
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const mapPoints: PropertyMapPoint[] = useMemo(
    () =>
      items
        .filter(
          (p): p is PublicListingSummaryDto & { latitude: number; longitude: number } =>
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
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

  const handleSearchThisArea = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const bounds = map.getBounds();
    const newRadius = center.distanceTo(bounds.getNorthEast()); // Leaflet tính sẵn, không cần haversine tay
    setSearchCenter({ lat: center.lat, lng: center.lng });
    setRadiusMeters(newRadius);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

  // ---- Giai đoạn 3: state responsive ----
  const [tabletView, setTabletView] = useState<"list" | "map">("list");
  const [mobileSnap, setMobileSnap] = useState<number | string | null>(0.5);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ---- Thanh kéo chỉnh tỷ lệ List/Map ở desktop — chỉ desktop mới có, tablet/mobile
  // giữ nguyên bố cục toggle/bottom-sheet đã làm. Luôn khởi tạo 40% (khớp SSR, tránh
  // hydration mismatch vì server không đọc được localStorage) — tỷ lệ đã lưu được áp
  // lại ở effect riêng, chỉ chạy phía client sau khi mount. ----
  const [listWidthPercent, setListWidthPercent] = useState(40);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const desktopSplitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(LIST_WIDTH_STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= 25 && saved <= 60) setListWidthPercent(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(listWidthPercent));
  }, [listWidthPercent]);

  const handleDividerMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    const container = desktopSplitRef.current;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const startX = e.clientX;
    const startWidth = listWidthPercent;
    setIsDraggingDivider(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const deltaPercent = ((ev.clientX - startX) / containerWidth) * 100;
      setListWidthPercent(Math.min(60, Math.max(25, startWidth + deltaPercent)));
    };
    const onMouseUp = () => {
      setIsDraggingDivider(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const activeFilterCount = (city.trim() ? 1 : 0) + (district.trim() ? 1 : 0);

  // ---- Chip cho cac bo loc ĐANG ap dung ----
  //
  // Khac han khoi `filterChips` ben duoi: kia la NUT MO bo loc (luon hien du chua chon
  // gi), day la thu da chon va go duoc tung cai. Khong co hang nay, nguoi dung cuon
  // xuong mot doan roi khong con biet vi sao ket qua it — ho chi thay "khong tim thay
  // tin nao" va bo di, trong khi thu phai go chi la mot bo loc gia dat tu luc truoc.
  const appliedFilters: { key: string; label: string; clear: () => void }[] = [];
  if (keyword.trim())
    appliedFilters.push({
      key: "keyword",
      label: `Từ khoá: ${keyword.trim()}`,
      clear: () => {
        setKeywordInput("");
        setKeyword("");
      },
    });
  if (district.trim())
    appliedFilters.push({
      key: "district",
      label: district.trim(),
      clear: () => setDistrict(""),
    });
  if (city.trim())
    appliedFilters.push({ key: "city", label: city.trim(), clear: () => setCity("") });
  if (priceMin != null || priceMax != null)
    appliedFilters.push({
      key: "price",
      label:
        priceMin != null && priceMax != null
          ? `${fmtShort(priceMin)} – ${fmtShort(priceMax)}`
          : priceMin != null
            ? `Từ ${fmtShort(priceMin)}`
            : `Đến ${fmtShort(priceMax!)}`,
      clear: () => {
        setPriceMin(null);
        setPriceMax(null);
      },
    });
  if (bedroomsMin != null)
    appliedFilters.push({
      key: "bedrooms",
      label: `Từ ${bedroomsMin} phòng ngủ`,
      clear: () => setBedroomsMin(null),
    });
  if (searchCenter)
    appliedFilters.push({
      key: "area",
      label: usingMyLocation
        ? `Quanh tôi ${myLocationRadiusKm} km`
        : `Trong bán kính ${Math.round((radiusMeters ?? DEFAULT_RADIUS_METERS) / 1000)} km`,
      clear: clearMyLocationSearch,
    });

  const clearAllFilters = () => appliedFilters.forEach((f) => f.clear());

  // Ap mot bo loc da luu tro lai trang. Phai dat TOAN BO state, ke ca ve null nhung o
  // nguoi dung khong dat — neu chi ghi de nhung truong co gia tri, bo loc cu con sot lai
  // se tron voi bo loc vua mo ra, va ket qua khong con giong luc ho bam luu.
  const applySavedSearch = (c: SavedSearchCriteria) => {
    setType((c.type ?? 1) as ListingTypeCode);
    setCity(c.city ?? "");
    setDistrict(c.district ?? "");
    setPriceMin(c.priceMin ?? null);
    setPriceMax(c.priceMax ?? null);
    setBedroomsMin(c.bedroomsMin ?? null);
    setKeywordInput(c.keyword ?? "");
    setKeyword(c.keyword ?? "");

    if (c.latitude != null && c.longitude != null && c.radiusMeters != null) {
      setSearchCenter({ lat: c.latitude, lng: c.longitude });
      setRadiusMeters(c.radiusMeters);
      // Toa do da luu la mot DIEM co dinh, khong phai "vi tri hien tai cua toi" — nguoi
      // dung co the dang o thanh pho khac so voi luc luu.
      setUsingMyLocation(false);
    } else {
      clearMyLocationSearch();
    }
    setShowSearchAreaButton(false);
  };

  // Ten goi y: tom tat chinh cac chip dang bat, de nguoi dung khong phai tu nghi ten.
  const suggestedSearchName =
    appliedFilters.map((f) => f.label).join(" · ").slice(0, 120) || "Bộ lọc của tôi";

  const appliedFilterBar =
    appliedFilters.length === 0 ? null : (
      <div className="flex flex-wrap items-center gap-1.5">
        {appliedFilters.map((f) => (
          <Badge
            key={f.key}
            variant="secondary"
            className="gap-1 pr-1 font-normal max-w-[220px]"
          >
            <span className="truncate">{f.label}</span>
            <button
              type="button"
              aria-label={`Bỏ lọc ${f.label}`}
              onClick={f.clear}
              className="rounded-full p-0.5 hover:bg-background/80 shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {appliedFilters.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={clearAllFilters}
          >
            Xoá tất cả
          </Button>
        )}
      </div>
    );

  // "Gần tôi nhất" chi xep duoc khi da co toa do — bay khong thi backend tu lui ve
  // "Mới nhất", nen an luon cho khoi hua hen thu minh khong lam duoc.
  const sortOptions = (Object.keys(LISTING_SORT) as unknown as ListingSortCode[])
    .map(Number)
    .filter((code) => code !== 5 || searchCenter != null) as ListingSortCode[];

  const resultsBar = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {query.isLoading ? "Đang tải..." : `${totalCount} bất động sản`}
      </p>
      <div className="flex items-center gap-1">
      <SavedSearchesPopover
        currentFilters={filters}
        suggestedName={suggestedSearchName}
        hasAnyFilter={appliedFilters.length > 0}
        onApply={applySavedSearch}
      />
      <Select
        value={String(sortBy)}
        onValueChange={(v) => setSortBy(Number(v) as ListingSortCode)}
      >
        <SelectTrigger className="h-8 w-auto gap-1.5 border-none shadow-none px-2 text-sm">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {sortOptions.map((code) => (
            <SelectItem key={code} value={String(code)}>
              {LISTING_SORT[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>
    </div>
  );

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
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Đến (VNĐ)</Label>
            <CurrencyInput
              value={priceMax}
              onChange={(v) => {
                setPriceMax(v);
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
              }}
              placeholder="VD: Quận 7"
            />
          </div>
        </PopoverContent>
      </Popover>

      <LocationSearchPopover
        open={radiusPopoverOpen}
        onOpenChange={setRadiusPopoverOpen}
        usingMyLocation={usingMyLocation}
        myLocationRadiusKm={myLocationRadiusKm}
        radiusInput={radiusInput}
        onRadiusInputChange={setRadiusInput}
        pending={geoStatus === "pending"}
        onSubmit={submitLocationSearch}
        onClear={clearMyLocationSearch}
      />

      <Button size="sm" variant="outline" className="h-8" onClick={() => setDemandSheetOpen(true)}>
        <Target className="h-3.5 w-3.5 mr-1.5" />
        Tìm theo nhu cầu
      </Button>
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

  // ---- Banner mời "Tìm theo nhu cầu" — không chặn nội dung, nằm ngay trong luồng
  // cuộn phía trên danh sách, người dùng vẫn dùng được trang duyệt tin bình thường. ----
  const demandBanner = showDemandBanner ? (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <span>Chưa biết tìm gì? Thử tìm theo nhu cầu cụ thể của bạn</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => setDemandSheetOpen(true)}>
          Tìm theo nhu cầu
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Đóng thông báo"
          onClick={dismissDemandBanner}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : null;

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
        query.isFetching && !isFetchingNextPage ? "opacity-60" : "opacity-100"
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
      {/* Cot moc cuon vo han. Van giu nut bam duoi day: IntersectionObserver khong
          chay khi nguoi dung dieu huong bang ban phim hoac trinh duyet chan no. */}
      <div ref={sentinelRef} className="pt-2 pb-4 text-center">
        {isFetchingNextPage ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thêm...
          </span>
        ) : hasNextPage ? (
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Xem thêm
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Đã hiển thị hết kết quả</span>
        )}
      </div>
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

      {/* ---- Desktop: split view List/Map kéo được tỷ lệ, mỗi bên cuộn/cố định độc lập ---- */}
      {viewportKind === "desktop" && (
        <div ref={desktopSplitRef} className="flex-1 min-h-0 flex flex-row">
          <div
            className="overflow-y-auto p-4 space-y-4 shrink-0"
            style={{ width: `${listWidthPercent}%` }}
          >
            {demandBanner}
            {appliedFilterBar}
            {resultsBar}
            {listContent}
          </div>
          {/* Thanh kéo chỉnh tỷ lệ List/Map — giới hạn 25%-60%, lưu vào localStorage */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để đổi tỷ lệ danh sách/bản đồ"
            className={`w-2 shrink-0 cursor-col-resize border-l hover:bg-primary/20 active:bg-primary/30 transition-colors ${
              isDraggingDivider ? "bg-primary/30" : ""
            }`}
            onMouseDown={handleDividerMouseDown}
          />
          <div className="flex-1 min-w-0">{mapContent}</div>
        </div>
      )}

      {/* ---- Tablet: toggle Danh sách/Bản đồ, giữ nguyên state khi chuyển (không unmount) ---- */}
      {viewportKind === "tablet" && (
        <div className="flex-1 min-h-0 relative">
          <div
            className={`absolute inset-0 overflow-y-auto p-4 space-y-4 ${tabletView === "list" ? "" : "invisible pointer-events-none"}`}
          >
            {demandBanner}
            {appliedFilterBar}
            {resultsBar}
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
            totalCount={totalCount}
            activeSnap={mobileSnap}
            onActiveSnapChange={setMobileSnap}
          >
            <div className="space-y-3">
              {demandBanner}
              {appliedFilterBar}
              {resultsBar}
              {listContent}
            </div>
          </MobileListSheet>
        </div>
      )}

      <DemandSearchSheet
        open={demandSheetOpen}
        onOpenChange={setDemandSheetOpen}
        onApply={handleDemandApply}
        myLocationPending={geoStatus === "pending"}
      />
    </div>
  );
}
