import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { MapEngine, MapViewApi } from "@/lib/mapEngine";
import {
  DEFAULT_TRAVEL,
  encodeRing,
  fetchIsochrone,
  profileLabel,
  type TravelMode,
} from "@/lib/mapboxNav";
import { TravelTimeControl } from "@/components/listings/TravelTimeControl";
import { PropertyFiltersPanel } from "@/components/public/PropertyFiltersPanel";
import { AssistantBar } from "@/components/public/AssistantBar";
import { assistantApi, type AssistantAnchor, type AssistantResult } from "@/lib/api/assistant";
import { geocodeForward } from "@/lib/geocode";
import { matchReasons } from "@/lib/matchReasons";
import {
  EMPTY_RENT_TERMS,
  isEmptyRentTerms,
  rentTermChips,
  rentTermsFromCriteria,
  rentTermsToSearchParams,
  type RentTerms,
} from "@/lib/rentTerms";
import {
  EMPTY_PROPERTY_FILTERS,
  countPropertyFilters,
  fromCriteria,
  propertyChips,
  toSearchParams,
  visibleFields,
  type PropertyFilterState,
} from "@/lib/propertyFilters";
import { TravelTimeToOrigin } from "@/components/listings/TravelTimeToOrigin";
import { useCommutePlace } from "@/hooks/useCommutePlace";
import { distanceMeters } from "@/lib/mapEngine";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedListingsApi } from "@/lib/api/engagement";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import {
  listingsApi,
  type PublicListingFilters,
  LISTING_SORT,
  type ListingSortCode,
  type PublicListingSummaryDto,
} from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { type AssetTypeCode, type ListingTypeCode } from "@/constants/enums";
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
import { AreaSearchBox } from "@/components/public/AreaSearchBox";
import { useCompareList } from "@/hooks/useCompareList";
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
  Columns2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Target,
  X,
  ArrowUpDown,
} from "lucide-react";

/**
 * Tham số trên URL — lối vào từ trang chủ, liên kết chia sẻ, ô khu vực…
 *
 * Trước đây trang này KHÔNG đọc URL: trang chủ chuyển sang `/tin-dang?keyword=…&city=…` nhưng
 * mọi điều kiện bị bỏ qua và người dùng thấy toàn bộ tin như chưa lọc gì. Nay các tham số chỉ
 * được áp MỘT LẦN lúc mở trang (sau đó bộ lọc trên trang là nguồn sự thật).
 *
 * `q` là một câu tiếng Việt gửi cho trợ lý — trang chủ có ô "Mô tả căn bạn cần".
 */
export interface ListingsSearchParams {
  q?: string;
  keyword?: string;
  city?: string;
  district?: string;
  type?: ListingTypeCode;
  priceMin?: number;
  priceMax?: number;
  /** Mã loại hình (AssetDomainType). */
  loai?: number;
  has3D?: boolean;
}

const numParam = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const strParam = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined;

export const Route = createFileRoute("/tin-dang/")({
  validateSearch: (s: Record<string, unknown>): ListingsSearchParams => {
    const type = numParam(s.type);
    return {
      q: strParam(s.q),
      keyword: strParam(s.keyword),
      city: strParam(s.city),
      district: strParam(s.district),
      type: type === 1 || type === 2 ? type : undefined,
      priceMin: numParam(s.priceMin),
      priceMax: numParam(s.priceMax),
      loai: numParam(s.loai),
      has3D:
        s.has3D === true || s.has3D === "1" || s.has3D === 1 || s.has3D === "true" || undefined,
    };
  },
  head: () => ({ meta: [{ title: "Tin đăng bất động sản — KGS" }] }),
  component: PublicListingsPage,
});

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]; // TP.HCM
const DEFAULT_RADIUS_METERS = 5000;
const LIST_WIDTH_STORAGE_KEY = "tin-dang:list-width-percent";
const DESKTOP_VIEW_STORAGE_KEY = "tin-dang:desktop-view";
type DesktopView = "split" | "list" | "map";

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
  // Đặc điểm bất động sản (loại hình, diện tích, pháp lý, hướng...) — mọi loại hình, mua lẫn thuê.
  const [prop, setProp] = useState<PropertyFilterState>(EMPTY_PROPERTY_FILTERS);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<ListingSortCode>(1);
  // ---- Trợ lý tìm nhà: câu tiếng Việt → bộ lọc của chính trang này ----
  const [assistant, setAssistant] = useState<AssistantResult | null>(null);
  // Điều kiện riêng của tin thuê (tổng chi phí, nội quy, tiện nghi bắt buộc) — trợ lý điền.
  const [rentTerms, setRentTerms] = useState<RentTerms>(EMPTY_RENT_TERMS);
  // Mong muốn MỀM — chỉ đẩy tin phù hợp lên trước (sắp "Phù hợp nhất"), không loại tin nào.
  const [prefer, setPrefer] = useState<string[]>([]);
  // Tâm tìm kiếm hiện tại có phải do trợ lý đặt không — để "Làm lại" gỡ đúng thứ trợ lý đã đặt.
  const centerFromAssistant = useRef(false);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Đồng bộ hover 2 chiều Card <-> Marker + click marker cuộn tới card
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Callback ỔN ĐỊNH (deps rỗng) truyền cho PropertyListCard đã bọc React.memo — nếu tạo
  // closure mới mỗi render (như trước) thì memo vô nghĩa, toàn bộ danh sách vẫn re-render
  // mỗi khi hoveredId đổi thay vì chỉ card liên quan.
  /**
   * Lưu tin ngay từ danh sách.
   *
   * Danh sách tin không trả về trạng thái đã-lưu của từng tin, nên lấy trọn danh sách đã
   * lưu một lần rồi tra bằng Set — rẻ hơn nhiều so với hỏi từng tin, và react-query giữ
   * lại nên chuyển qua lại giữa các trang không gọi lại.
   */
  const savedQuery = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => savedListingsApi.list(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });
  const savedIds = useMemo(
    () => new Set((savedQuery.data ?? []).map((s) => s.listingId)),
    [savedQuery.data],
  );

  const toggleSave = useMutation({
    mutationFn: ({ id, dangLuu }: { id: string; dangLuu: boolean }) =>
      dangLuu ? savedListingsApi.unsave(id) : savedListingsApi.save(id),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["saved-listings"] });
      toast.success(v.dangLuu ? "Đã bỏ lưu tin" : "Đã lưu tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được tin")),
  });

  const handleToggleSave = useCallback(
    (id: string) => {
      // Chưa đăng nhập thì không im lặng nuốt thao tác: đưa sang đăng nhập kèm đường quay lại.
      if (!isAuthenticated) {
        navigate({ to: "/login", search: { redirect: "/tin-dang" } });
        return;
      }
      toggleSave.mutate({ id, dangLuu: savedIdsRef.current.has(id) });
    },
    // Cố ý deps rỗng: callback phải ỔN ĐỊNH để React.memo trên thẻ còn tác dụng. Trạng thái
    // đã-lưu đọc qua ref thay vì đóng gói vào closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated],
  );
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  const {
    items: compareItems,
    has: compareHas,
    toggle: compareToggle,
    max: compareMax,
  } = useCompareList();

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
  const mapRef = useRef<MapViewApi | null>(null);

  const [usingMyLocation, setUsingMyLocation] = useState(false);

  // ---- Tìm theo thời gian đi lại (Mapbox Isochrone) ----
  // Chỉ bật khi bản đồ chạy GL: điều khoản Mapbox bắt buộc vùng Isochrone hiển thị trên bản
  // đồ Mapbox. Bản Leaflet dự phòng thì tính năng này ẩn đi, không lùi về cách khác.
  const [mapEngine, setMapEngine] = useState<MapEngine | null>(null);
  const [travel, setTravel] = useState<TravelMode | null>(null);
  // Người dùng đã mở luồng "tìm theo thời gian đi làm": lần đặt ghim kế tiếp là điểm xuất phát.
  const [travelIntent, setTravelIntent] = useState(false);
  // Ghim là gì ("Chỗ làm", "Vị trí của tôi"...) — hiện trên đầu ghim và trong chip bộ lọc.
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const commute = useCommutePlace();
  const pendingTravelGeoRef = useRef(false);
  const travelEnabled = mapEngine === "gl" && !!travel && !!searchCenter;
  const isoQ = useQuery({
    queryKey: [
      "isochrone",
      searchCenter?.lat.toFixed(4),
      searchCenter?.lng.toFixed(4),
      travel?.profile,
      travel?.minutes,
    ],
    queryFn: ({ signal }) =>
      fetchIsochrone(searchCenter!, travel!.profile, travel!.minutes, signal),
    enabled: travelEnabled,
    // Cùng điểm, cùng cách đi, cùng số phút thì vùng không đổi trong một phiên — không gọi lại.
    staleTime: Infinity,
    retry: 1,
  });
  const travelArea = travelEnabled ? (isoQ.data ?? null) : null;
  const travelOriginLabel = centerLabel ?? "Điểm xuất phát";
  const centerIsSavedPlace =
    !!searchCenter && !!commute.place && distanceMeters(searchCenter, commute.place) < 30;
  useEffect(() => {
    if (!isoQ.isError || !travel) return;
    toast.error("Không tính được vùng đi lại lúc này — đang dùng lại bán kính.");
    setTravel(null);
    setTravelIntent(false);
  }, [isoQ.isError, travel]);
  useEffect(() => {
    if (mapEngine === "leaflet") setTravel(null);
  }, [mapEngine]);
  const [myLocationRadiusKm, setMyLocationRadiusKm] = useState(5);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const [radiusInput, setRadiusInput] = useState("5");
  const pendingRadiusKmRef = useRef<number | null>(null);

  // Xử lý kết quả sau khi request() hoàn tất (được gọi từ nút "Tìm kiếm" trong popover) —
  // requestId chỉ đổi khi có kết quả mới (granted/denied), tránh xử lý trùng.
  useEffect(() => {
    if (requestId === 0 || !pendingTravelGeoRef.current) return;
    pendingTravelGeoRef.current = false;
    if (geoStatus === "granted" && userLocation) {
      setSearchCenter(userLocation);
      setRadiusMeters((r) => r ?? DEFAULT_RADIUS_METERS);
      setCenterLabel("Vị trí của tôi");
      setUsingMyLocation(false);
      setTravel((t) => t ?? { ...DEFAULT_TRAVEL, profile: commute.profile });
    } else if (geoStatus === "denied" || geoStatus === "unsupported") {
      toast.error("Không lấy được vị trí — hãy gõ địa chỉ hoặc bấm lên bản đồ.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

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
    setTravel(null);
    setTravelIntent(false);
    setCenterLabel(null);
    setSearchCenter(null);
    setRadiusMeters(null);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(keywordInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [keywordInput]);

  const [demandSheetOpen, setDemandSheetOpen] = useState(false);

  // Áp toàn bộ lựa chọn từ form "Tìm theo nhu cầu" vào bộ lọc hiện có — tái sử dụng
  // đúng state/logic sẵn có (ô địa chỉ, city/district, luồng xin quyền vị trí), không
  // viết trùng logic tìm kiếm.
  const handleDemandApply = (result: DemandSearchResult) => {
    setType(result.type);
    setPriceMin(result.priceMin);
    setPriceMax(result.priceMax);
    setBedroomsMin(result.bedroomsMin);
    if (result.location?.kind === "district") {
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
    keyword,
    latitude: searchCenter?.lat ?? "",
    longitude: searchCenter?.lng ?? "",
    // Chế độ thời gian đi lại: vòng tròn bao ngoài vùng (lọc thô qua GiST index) + chính
    // vùng đó (lọc chính xác). Vùng chưa về thì vẫn tìm theo bán kính cũ.
    radiusMeters: travelArea
      ? travelArea.boundingRadiusMeters
      : searchCenter && radiusMeters
        ? radiusMeters
        : "",
    within: travelArea ? encodeRing(travelArea.ring) : "",
    ...toSearchParams(prop),
    ...rentTermsToSearchParams(rentTerms),
    prefer: prefer.length ? prefer.join(";") : undefined,
    bedroomsMin: visibleFields(prop, type).rooms ? (bedroomsMin ?? "") : "",
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
          unitName: p.unitName,
          rentPaymentCycle: p.rentPaymentCycle,
          area: p.area,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          district: p.district,
          city: p.city,
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
    // Ghim vừa bấm/kéo không còn là "Chỗ làm đã lưu" hay "Vị trí của tôi" nữa.
    setCenterLabel(null);
    if (travelIntent && !travel) setTravel({ ...DEFAULT_TRAVEL, profile: commute.profile });
    if (radiusMeters == null) setRadiusMeters(DEFAULT_RADIUS_METERS);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

  const handleSearchThisArea = () => {
    const map = mapRef.current;
    if (!map) return;
    setTravel(null); // "khu vực đang nhìn thấy" là một khung, không phải vùng đi lại
    setTravelIntent(false);
    setCenterLabel(null);
    const center = map.getCenter();
    const newRadius = map.getViewRadiusMeters(); // tâm → góc khung nhìn: vừa phủ trọn vùng đang thấy
    setSearchCenter({ lat: center.lat, lng: center.lng });
    setRadiusMeters(newRadius);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
  };

  // ---- Giai đoạn 3: state responsive ----
  const [tabletView, setTabletView] = useState<"list" | "map">("list");
  const [mobileSnap, setMobileSnap] = useState<number | string | null>(0.5);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);

  // ---- Thanh kéo chỉnh tỷ lệ List/Map ở desktop — chỉ desktop mới có, tablet/mobile
  // giữ nguyên bố cục toggle/bottom-sheet đã làm. Luôn khởi tạo 40% (khớp SSR, tránh
  // hydration mismatch vì server không đọc được localStorage) — tỷ lệ đã lưu được áp
  // lại ở effect riêng, chỉ chạy phía client sau khi mount. ----
  // 48%: thẻ tin dạng NGANG cần cột đủ rộng để ảnh và chữ cùng thở được.
  const [listWidthPercent, setListWidthPercent] = useState(48);
  // Chia đôi (mặc định) · chỉ danh sách (đọc kỹ, so sánh nhiều tin) · chỉ bản đồ (tìm theo
  // vị trí). Nhớ lựa chọn trong máy, áp lại sau khi mount như tỉ lệ cột.
  const [desktopView, setDesktopView] = useState<DesktopView>("split");
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const desktopSplitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LIST_WIDTH_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 25 && saved <= 60) setListWidthPercent(saved);
      const view = window.localStorage.getItem(DESKTOP_VIEW_STORAGE_KEY);
      if (view === "split" || view === "list" || view === "map") setDesktopView(view);
    } catch {
      // Trình duyệt chặn localStorage: dùng mặc định.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_VIEW_STORAGE_KEY, desktopView);
    } catch {
      // bỏ qua
    }
  }, [desktopView]);

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

  const activeFilterCount =
    (city.trim() ? 1 : 0) +
    (district.trim() ? 1 : 0) +
    (priceMin != null || priceMax != null ? 1 : 0) +
    (bedroomsMin != null ? 1 : 0) +
    countPropertyFilters(prop);

  // Đổi mua/thuê hay loại hình làm một trường không còn áp dụng (chọn "Đất" thì không còn
  // phòng tắm; sang "Cho thuê" thì không lọc sổ hồng) — gỡ luôn điều kiện của trường đó.
  // Để lại thì nó vẫn âm thầm lọc dù người dùng không còn nhìn thấy nó ở đâu.
  useEffect(() => {
    const show = visibleFields(prop, type);
    const next: PropertyFilterState = {
      ...prop,
      bathroomsMin: show.rooms ? prop.bathroomsMin : null,
      floorsMin: show.floors ? prop.floorsMin : null,
      frontageMin: show.frontage ? prop.frontageMin : null,
      directions: show.direction ? prop.directions : [],
      legal: show.legal ? prop.legal : [],
      furniture: show.furniture ? prop.furniture : [],
    };
    const changed =
      next.bathroomsMin !== prop.bathroomsMin ||
      next.floorsMin !== prop.floorsMin ||
      next.frontageMin !== prop.frontageMin ||
      next.directions.length !== prop.directions.length ||
      next.legal.length !== prop.legal.length ||
      next.furniture.length !== prop.furniture.length;
    if (changed) setProp(next);
    if (!show.rooms && bedroomsMin != null) setBedroomsMin(null);
  }, [prop, type, bedroomsMin]);

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
  appliedFilters.push(...propertyChips(prop, setProp));
  appliedFilters.push(...rentTermChips(rentTerms, setRentTerms));
  if (prefer.length)
    appliedFilters.push({
      key: "prefer",
      label: `Ưu tiên: ${prefer.join(", ")}`,
      clear: () => {
        setPrefer([]);
        if (sortBy === 6) setSortBy(1);
      },
    });
  if (searchCenter)
    appliedFilters.push({
      key: "area",
      label: travelArea
        ? `≤ ${travel!.minutes} phút ${profileLabel(travel!.profile)} tới ${travelOriginLabel.toLowerCase()}`
        : usingMyLocation
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
    setProp(fromCriteria(c));
    setRentTerms(rentTermsFromCriteria(c));
    setPrefer([]);
    setAssistant(null);
    setTravel(null);
    setTravelIntent(false);
    setCenterLabel(null);

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
  //
  // Vùng đi lại không được lưu (điều khoản Mapbox) — bộ lọc lưu giữ vòng tròn bao ngoài vùng,
  // nên tên gợi ý cũng phải nói đúng là bán kính, không hứa "15 phút" mà thứ lưu không giữ.
  const suggestedSearchName =
    appliedFilters
      .map((f) =>
        f.key === "area" && travelArea
          ? `Bán kính ${Math.round(travelArea.boundingRadiusMeters / 1000)} km`
          : f.label,
      )
      .join(" · ")
      .slice(0, 120) || "Bộ lọc của tôi";
  const savedSearchFilters = travelArea ? { ...filters, within: "" } : filters;

  // ---- Trợ lý tìm nhà: áp kết quả vào bộ lọc của trang ----
  // Điều kiện thuê không có nghĩa với tin bán — đổi sang "Bán" thì gỡ, để không âm thầm lọc
  // tin bán theo những trường tin bán không bao giờ khai.
  useEffect(() => {
    if (type === 1 && !isEmptyRentTerms(rentTerms)) setRentTerms(EMPTY_RENT_TERMS);
  }, [type, rentTerms]);

  const sameAnchor = (a: AssistantAnchor | null | undefined, b: AssistantAnchor | null) =>
    !!a &&
    !!b &&
    a.text === b.text &&
    a.travelMinutes === b.travelMinutes &&
    a.travelMode === b.travelMode &&
    a.radiusKm === b.radiusKm;

  // Điểm neo ("làm ở Hàm Nghi"): tìm trên bản đồ rồi dùng đúng luồng tìm quanh điểm / theo thời
  // gian đi lại sẵn có. Chỉ trên bản đồ GL — kết quả geocoding và Isochrone của Mapbox phải
  // hiển thị trên bản đồ Mapbox.
  const applyAnchor = async (a: AssistantAnchor | null) => {
    if (!a) {
      if (centerFromAssistant.current) {
        clearMyLocationSearch();
        centerFromAssistant.current = false;
      }
      return;
    }
    if (mapEngine !== "gl") {
      toast.info(`Tìm quanh “${a.text}” cần bản đồ Mapbox — đang dùng bản đồ dự phòng nên bỏ qua.`);
      return;
    }
    const prox = searchCenter ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
    const hit = (await geocodeForward(a.text, prox).catch(() => null))?.[0];
    if (!hit) {
      toast.warning(`Không tìm thấy “${a.text}” trên bản đồ`, {
        description: "Bấm lên bản đồ đúng chỗ đó để tìm quanh điểm ấy.",
      });
      return;
    }
    setSearchCenter({ lat: hit.lat, lng: hit.lng });
    setCenterLabel(a.text);
    setUsingMyLocation(false);
    setShowSearchAreaButton(false);
    centerFromAssistant.current = true;
    if (a.travelMinutes) {
      setRadiusMeters((r) => r ?? DEFAULT_RADIUS_METERS);
      setTravel({
        profile:
          a.travelMode === "walking"
            ? "walking"
            : a.travelMode === "cycling"
              ? "cycling"
              : "driving-traffic",
        minutes: a.travelMinutes,
      });
      setTravelIntent(true);
    } else {
      setTravel(null);
      setRadiusMeters(Math.round((a.radiusKm ?? 3) * 1000));
    }
  };

  const applyAssistant = (r: AssistantResult) => {
    const c = r.criteria;
    if (c.type === 1 || c.type === 2) setType(c.type as ListingTypeCode);
    setCity(c.city ?? "");
    setDistrict(c.district ?? "");
    setPriceMin(c.priceMin ?? null);
    setPriceMax(c.priceMax ?? null);
    setBedroomsMin(c.bedroomsMin ?? null);
    setKeywordInput(c.keyword ?? "");
    setKeyword(c.keyword ?? "");
    setProp(fromCriteria(c));
    setRentTerms(rentTermsFromCriteria(c));
    setPrefer(r.preferences);
    setSortBy(r.preferences.length ? 6 : sortBy === 6 ? 1 : sortBy);
    const previous = assistant?.anchor;
    setAssistant(r);
    if (!sameAnchor(previous, r.anchor)) void applyAnchor(r.anchor);
  };

  // Áp tham số URL một lần lúc mở trang (xem ListingsSearchParams).
  const initialSearch = Route.useSearch();
  const appliedUrl = useRef(false);
  useEffect(() => {
    if (appliedUrl.current) return;
    appliedUrl.current = true;
    const u = initialSearch;
    if (u.type) setType(u.type);
    if (u.city) setCity(u.city);
    if (u.district) setDistrict(u.district);
    if (u.priceMin != null) setPriceMin(u.priceMin);
    if (u.priceMax != null) setPriceMax(u.priceMax);
    if (u.keyword) {
      setKeywordInput(u.keyword);
      setKeyword(u.keyword);
    }
    if (u.loai != null || u.has3D) {
      setProp({
        ...EMPTY_PROPERTY_FILTERS,
        types: u.loai != null ? [u.loai as AssetTypeCode] : [],
        has3D: !!u.has3D,
      });
    }
    if (u.q) {
      const q = u.q;
      toast.promise(assistantApi.searchIntent(q, null), {
        loading: "Trợ lý đang đọc yêu cầu của bạn…",
        success: (r) => {
          applyAssistant(r);
          return "Đã lọc theo yêu cầu — xem trợ lý hiểu thế nào ở khung phía trên.";
        },
        error: (e) => getErrorMessage(e, "Trợ lý tạm thời không dùng được — hãy lọc bằng tay."),
      });
    }
    // Chỉ chạy lúc mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAssistant = () => {
    clearAllFilters();
    setPrefer([]);
    if (sortBy === 6) setSortBy(1);
    setAssistant(null);
    centerFromAssistant.current = false;
  };

  const assistantBar = (
    <AssistantBar result={assistant} onResult={applyAssistant} onReset={resetAssistant} />
  );

  // "Vì sao hợp" cho từng tin — tính bằng quy tắc từ dữ liệu thật (lib/matchReasons.ts), chỉ
  // khi đang tìm qua trợ lý. Gói trong useMemo để thẻ tin (React.memo) không vẽ lại thừa.
  const reasonsById = useMemo(() => {
    if (!assistant) return null;
    const ctx = {
      priceMax,
      totalCostMax: rentTerms.totalCostMax,
      bedroomsMin,
      areaMin: prop.areaMin,
      areaMax: prop.areaMax,
      petsAllowed: rentTerms.petsAllowed,
      amenities: rentTerms.amenities,
      centerLabel: searchCenter ? centerLabel : null,
    };
    return new Map(items.map((p) => [p.id, matchReasons(p, ctx)]));
  }, [assistant, items, priceMax, rentTerms, bedroomsMin, prop, searchCenter, centerLabel]);

  const appliedFilterBar =
    appliedFilters.length === 0 ? null : (
      <div className="flex flex-wrap items-center gap-1.5">
        {appliedFilters.map((f) => (
          <Badge key={f.key} variant="secondary" className="gap-1 pr-1 font-normal max-w-[220px]">
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
    .filter((code) => code !== 5 || searchCenter != null)
    .filter((code) => code !== 6 || prefer.length > 0) as ListingSortCode[];

  // Trên điện thoại khung danh sách đã ghi số kết quả ở tay nắm — không lặp lại ở đây, nhường
  // chỗ cho hàng nút (trước đây số "43 bất động sản" bị ép xuống ba dòng).
  const resultsBar = (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      {viewportKind !== "mobile" && (
        <p className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
          {query.isLoading ? "Đang tải..." : `${totalCount} bất động sản`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-sm"
          onClick={() => setDemandSheetOpen(true)}
        >
          <Target className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          Tìm theo nhu cầu
        </Button>
        <SavedSearchesPopover
          currentFilters={savedSearchFilters}
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
  // Bộ lọc tách làm HAI nhóm, và đây là thay đổi bố cục chính của trang.
  //
  // Trước đây cả tám thứ — bán/thuê, khoảng giá, phòng ngủ, tiện ích, quanh vị trí, theo
  // nhu cầu, ô địa chỉ, ô từ khoá — nằm chung một hàng ngang. Tám điều khiển cùng cấp bậc
  // thị giác thì không cái nào nổi lên, và người dùng phải đọc hết mới biết nên bấm cái
  // nào trước.
  //
  // Nhóm CHÍNH là ba thứ gần như ai cũng dùng ngay: mua hay thuê, ở đâu, tìm gì. Phần còn
  // lại lùi vào một nút 'Bộ lọc' có đếm số — vẫn cách đúng một cú bấm, nhưng không tranh
  // chỗ với ba thứ kia nữa.
  /* Bán / Cho thuê là quyết định ĐẦU TIÊN và lớn nhất trên trang này — nó đổi ý nghĩa của
     mọi con số phía sau (tiền tỷ so với tiền triệu mỗi tháng). Trước đây nó cao 32px, cùng
     cỡ và cùng sức nặng với nút "Bộ lọc" và ô tìm kiếm, nên không có gì cho biết đây là
     lựa chọn cấp cao hơn. */
  const typeToggle = (
    <div className="inline-flex rounded-md border bg-muted/60 p-0.5">
      <Button
        size="sm"
        variant={type === 1 ? "default" : "ghost"}
        className="h-9 rounded-sm px-4"
        onClick={() => {
          setType(1);
        }}
      >
        Bán
      </Button>
      <Button
        size="sm"
        variant={type === 2 ? "default" : "ghost"}
        className="h-9 rounded-sm px-4"
        onClick={() => {
          setType(2);
        }}
      >
        Cho thuê
      </Button>
    </div>
  );

  const secondaryFilters = (
    <>
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

      {visibleFields(prop, type).rooms && (
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
      )}

      {/* Popover "Thêm bộ lọc" đã gỡ.
          Nó chỉ chứa hai ô GÕ TAY cho thành phố và quận/huyện — người dùng phải gõ đúng
          từng dấu và đúng tiền tố ("TP. Hồ Chí Minh", "Quận 7") thì bộ lọc mới khớp. Ô tìm
          khu vực ngoài thanh công cụ nay chọn thẳng từ danh sách hành chính nên luôn trả về
          đúng tên đang lưu trong cơ sở dữ liệu, và nó nằm ngay chỗ người dùng nhìn vào đầu
          tiên thay vì bị chôn trong một popover lồng trong popover. */}

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

      {/* Nút "Tìm theo nhu cầu" đã chuyển lên thanh kết quả — nó là một CÁCH TÌM, không phải
          một bộ lọc, nên chôn nó trong popover Bộ lọc thì gần như không ai thấy. */}
    </>
  );

  // Giữ lại cho bảng lọc trên điện thoại — ở đó mọi thứ vốn đã nằm trong một sheet riêng.
  const filterChips = (
    <>
      {typeToggle}
      {secondaryFilters}
    </>
  );

  const addressSearchBox = (className?: string) => (
    <AreaSearchBox
      className={className}
      city={city}
      district={district}
      type={type}
      onPick={({ city: c, district: d }) => {
        setCity(c);
        setDistrict(d);
      }}
      onClear={() => {
        setCity("");
        setDistrict("");
      }}
    />
  );

  const keywordSearchBox = (className?: string) => (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Tìm theo tiêu đề, mô tả..."
        className="pl-9 h-9"
        value={keywordInput}
        onChange={(e) => setKeywordInput(e.target.value)}
      />
    </div>
  );

  // ---- Banner mời "Tìm theo nhu cầu" — không chặn nội dung, nằm ngay trong luồng
  // cuộn phía trên danh sách, người dùng vẫn dùng được trang duyệt tin bình thường. ----

  // ---- Nội dung danh sách (dùng chung mọi breakpoint) ----
  // Skeleton phải dùng ĐÚNG lưới của danh sách thật. Trước đây nó cứng grid-cols-2 trong khi
  // danh sách thật đã chuyển sang container query — nên lúc dữ liệu về, bố cục nhảy từ 2 cột
  // sang 4 cột ngay trước mắt người dùng.
  const listContent = query.isLoading ? (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="flex-row gap-0 overflow-hidden py-0">
            <Skeleton className="h-[184px] w-[40%] shrink-0 rounded-none" />
            <div className="flex-1 space-y-2 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
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
    /* Trạng thái rỗng phải cho LỐI THOÁT, không chỉ lời khuyên.
       Bản cũ viết "Thử mở rộng bán kính hoặc bỏ bớt bộ lọc" rồi dừng ở đó — người dùng vẫn
       phải tự đi tìm xem mình đã đặt những điều kiện nào và gỡ ở đâu, mà các chip điều kiện
       thì nằm tận trên đầu trang. Ở đây liệt kê đúng những điều kiện đang bật, gỡ được ngay
       tại chỗ, kèm một nút xoá sạch. */
    <Card className="p-8 text-center space-y-4">
      <Home className="h-10 w-10 mx-auto text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="font-medium">
          Không có tin nào khớp {appliedFilters.length > 0 ? "các điều kiện này" : "tìm kiếm này"}
        </p>
        <p className="text-sm text-muted-foreground">
          {appliedFilters.length > 0
            ? "Gỡ bớt một điều kiện bên dưới để mở rộng kết quả."
            : "Thử đổi từ khoá, hoặc chuyển giữa Bán và Cho thuê."}
        </p>
      </div>

      {appliedFilters.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {appliedFilters.map((f) => (
              <Button key={f.key} size="sm" variant="outline" className="h-8" onClick={f.clear}>
                {f.label}
                <X className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={clearAllFilters}>
            Xoá tất cả điều kiện
          </Button>
        </>
      )}
    </Card>
  ) : (
    // Fade nhẹ (không nhảy cóc) khi đổi filter mà đang refetch — vẫn giữ layout cũ, không
    // thay skeleton hoàn toàn để tránh "giật" bố cục
    <div
      className={`space-y-4 transition-opacity duration-200 ${
        query.isFetching && !isFetchingNextPage ? "opacity-60" : "opacity-100"
      }`}
    >
      {/* @container: cột danh sách này KÉO GIÃN ĐƯỢC (người dùng tự chỉnh bề rộng, lưu ở
          localStorage), nên số cột phải theo bề rộng của chính nó chứ không theo viewport.
          Trước đây cứng grid-cols-2 ở mọi bề rộng: kéo rộng ra thì thẻ phình to vô ích, thu
          hẹp lại thì hai thẻ chen nhau không đọc được. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-2">
          {items.map((p) => (
            <PropertyListCard
              key={p.id}
              property={p}
              ref={(el) => {
                cardRefs.current[p.id] = el;
              }}
              hovered={hoveredId === p.id}
              highlighted={highlightedId === p.id}
              saved={savedIds.has(p.id)}
              onToggleSave={handleToggleSave}
              onHover={handleCardHover}
              onLeave={handleCardLeave}
              compareSelected={compareHas(p.id)}
              compareFull={compareItems.length >= compareMax && !compareHas(p.id)}
              onToggleCompare={compareToggle}
              reasons={reasonsById?.get(p.id)}
            />
          ))}
        </div>
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
          radiusMeters={travelArea ? null : radiusMeters}
          areaPolygon={travelArea?.ring ?? null}
          searchCenterLabel={travel ? travelOriginLabel : null}
          popupExtra={
            travelArea && searchCenter
              ? (p) => (
                  <TravelTimeToOrigin
                    from={{ lat: p.lat, lng: p.lng }}
                    to={searchCenter}
                    toLabel={travelOriginLabel}
                    profile={travel!.profile}
                  />
                )
              : undefined
          }
          onEngine={setMapEngine}
          listingType={type}
          priceFilters={filters}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
          onShowSearchAreaButtonChange={setShowSearchAreaButton}
        />
      )}
      {mapEngine === "gl" && (
        <TravelTimeControl
          intent={travelIntent}
          onIntentChange={setTravelIntent}
          hasCenter={!!searchCenter}
          centerLabel={travelOriginLabel}
          proximity={searchCenter ? [searchCenter.lat, searchCenter.lng] : null}
          travel={travel}
          onTravelChange={(t) => {
            setTravel(t);
            // Cách đi là thói quen của người dùng — nhớ lại cho lần sau và cho trang chi tiết.
            if (t) commute.setProfile(t.profile);
          }}
          loading={travelEnabled && isoQ.isFetching}
          savedPlace={commute.place}
          onUseSavedPlace={() => {
            const p = commute.place;
            if (!p) return;
            setSearchCenter({ lat: p.lat, lng: p.lng });
            setRadiusMeters((r) => r ?? DEFAULT_RADIUS_METERS);
            setCenterLabel(p.label);
            setUsingMyLocation(false);
            setShowSearchAreaButton(false);
            setTravel((t) => t ?? { ...DEFAULT_TRAVEL, profile: commute.profile });
          }}
          onUseMyLocation={() => {
            pendingTravelGeoRef.current = true;
            requestGeolocation();
          }}
          locating={geoStatus === "pending"}
          onGeocode={(lat, lng) => mapRef.current?.flyTo(lat, lng, 16)}
          canSaveCenter={!!searchCenter && !centerIsSavedPlace}
          onSaveCenter={() => {
            if (!searchCenter) return;
            const label = centerLabel && centerLabel !== "Vị trí của tôi" ? centerLabel : "Chỗ làm";
            commute.setPlace({ lat: searchCenter.lat, lng: searchCenter.lng, label });
            setCenterLabel(label);
            toast.success(`Đã lưu làm "${label}"`, {
              description: "Mở tin nào cũng sẽ thấy thời gian đi tới đây.",
            });
          }}
        />
      )}
      {showSearchAreaButton && (
        <Button
          size="sm"
          className="map-overlay absolute top-3 left-1/2 -translate-x-1/2 shadow-lg"
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

      {/* Trang này là bố cục ứng dụng chiếm trọn màn hình nên không có chỗ cho một tiêu đề
          nhìn thấy được. Nhưng trang vẫn cần đúng một h1: trình đọc màn hình dùng nó để
          trả lời "tôi đang ở đâu", và công cụ tìm kiếm dùng nó để hiểu trang nói về gì.
          Ẩn về mặt thị giác, không ẩn về mặt ngữ nghĩa. */}
      <h1 className="sr-only">Tìm kiếm nhà trọ, phòng cho thuê và bất động sản</h1>

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
          {viewportKind === "desktop" && (
            <div
              className="mr-1 inline-flex rounded-md border p-0.5"
              role="group"
              aria-label="Chế độ xem"
            >
              {(
                [
                  ["split", "Chia đôi", Columns2],
                  ["list", "Danh sách", List],
                  ["map", "Bản đồ", MapIcon],
                ] as const
              ).map(([v, label, Icon]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={desktopView === v ? "default" : "ghost"}
                  className="h-8 rounded-sm px-2.5"
                  aria-pressed={desktopView === v}
                  title={label}
                  onClick={() => setDesktopView(v)}
                >
                  <Icon className="h-3.5 w-3.5 xl:mr-1.5" />
                  <span className="hidden xl:inline">{label}</span>
                </Button>
              ))}
            </div>
          )}
          {typeToggle}

          {/* Vạch ngăn: tách "đang xem loại tin nào" khỏi "lọc trong loại đó". Không có nó,
              sáu điều khiển đứng thành một dải liền không phân nhóm. */}
          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />

          {addressSearchBox("w-56")}
          {keywordSearchBox("flex-1 min-w-[200px] max-w-md")}

          <Popover open={desktopFilterOpen} onOpenChange={setDesktopFilterOpen}>
            <PopoverTrigger asChild>
              {/* Nút đổi sang dạng đặc khi đang có điều kiện lọc — trạng thái nói ra bằng
                  HÌNH DẠNG chứ không chỉ bằng con số nhỏ trong ngoặc. */}
              <Button
                size="sm"
                variant={activeFilterCount > 0 ? "default" : "outline"}
                className="h-9 ml-auto shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(460px,calc(100vw-2rem))] max-h-[min(640px,75vh)] overflow-y-auto"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lọc thêm
              </p>
              <div className="flex flex-wrap gap-2">{secondaryFilters}</div>
              <p className="mb-2 mt-4 border-t pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Đặc điểm bất động sản
              </p>
              <PropertyFiltersPanel value={prop} onChange={setProp} mode={type as 1 | 2} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ---- Mobile: filter/search dạng nổi phía trên bản đồ ---- */}
      {viewportKind === "mobile" && (
        <div className="absolute top-14 inset-x-0 z-30 px-3 pt-3 flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto rounded-md bg-card shadow-md">
            {addressSearchBox()}
          </div>
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
                  <p className="border-t pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Đặc điểm bất động sản
                  </p>
                  <PropertyFiltersPanel value={prop} onChange={setProp} mode={type as 1 | 2} />
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
            className={`overflow-y-auto p-4 space-y-4 shrink-0 ${desktopView === "map" ? "hidden" : ""}`}
            style={{ width: desktopView === "list" ? "100%" : `${listWidthPercent}%` }}
          >
            {/* Danh sách toàn trang: giới hạn bề rộng đọc, căn giữa. */}
            <div
              className={desktopView === "list" ? "mx-auto max-w-[1400px] space-y-4" : "space-y-4"}
            >
              {assistantBar}
              {appliedFilterBar}
              {resultsBar}
              {listContent}
            </div>
          </div>
          {/* Thanh kéo chỉnh tỷ lệ List/Map — giới hạn 25%-60%, lưu vào localStorage */}
          <div
            hidden={desktopView !== "split"}
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để đổi tỷ lệ danh sách/bản đồ"
            className={`w-2 shrink-0 cursor-col-resize border-l hover:bg-primary/20 active:bg-primary/30 transition-colors ${
              isDraggingDivider ? "bg-primary/30" : ""
            }`}
            onMouseDown={handleDividerMouseDown}
          />
          {/* Bản đồ vẫn dựng khi ẩn (chế độ Danh sách): giữ vị trí, mức phóng và khối 3D, và
              không tốn thêm một lượt tải bản đồ Mapbox khi chuyển lại. */}
          <div className={`flex-1 min-w-0 ${desktopView === "list" ? "hidden" : ""}`}>
            {mapContent}
          </div>
        </div>
      )}

      {/* ---- Tablet: toggle Danh sách/Bản đồ, giữ nguyên state khi chuyển (không unmount) ---- */}
      {viewportKind === "tablet" && (
        <div className="flex-1 min-h-0 relative">
          <div
            className={`absolute inset-0 overflow-y-auto p-4 space-y-4 ${tabletView === "list" ? "" : "invisible pointer-events-none"}`}
          >
            {assistantBar}
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
              {assistantBar}
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
