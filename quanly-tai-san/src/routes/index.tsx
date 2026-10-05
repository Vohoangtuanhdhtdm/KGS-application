import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savedListingsApi } from "@/lib/api/engagement";
import { useAuth } from "@/lib/auth/AuthContext";
import { getErrorMessage } from "@/lib/api/errors";
import { PropertyListCard } from "@/components/public/PropertyListCard";
import { listingsApi, formatListingPrice } from "@/lib/api/listings";
import { useCompareList } from "@/hooks/useCompareList";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  BedDouble,
  Box,
  Briefcase,
  Building2,
  Calculator,
  House,
  LandPlot,
  LineChart,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { ListingTypeCode } from "@/constants/enums";

/**
 * TRANG CHỦ — mặt tiền của sản phẩm.
 *
 * Màn hình đầu dồn vào MỘT việc: nói ra căn mình cần. Ô chính là trợ lý AI (một câu tiếng
 * Việt → bộ lọc), vì đó là thứ KGS làm mà các sàn tin đăng khác không làm; tìm theo khu vực
 * kiểu cũ vẫn ở ngay cạnh cho ai quen cách đó. Bên dưới, mỗi khối đều là DỮ LIỆU THẬT dẫn
 * thẳng vào kết quả: loại hình, tin mới nhất, toà nhà có mô hình 3D, khu vực đang có nhiều
 * tin — không còn khối chữ giới thiệu chiếm chỗ mà không bấm vào đâu được.
 *
 * Trang này CÔNG KHAI: khách chưa đăng nhập vẫn tìm, hỏi trợ lý và xem tin được.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KGS — Tìm nhà trọ, căn hộ cho thuê và bất động sản" },
      {
        name: "description",
        content:
          "Nền tảng tìm kiếm và kết nối bất động sản tích hợp AI: mô tả căn bạn cần bằng một câu, xem tổng chi phí thật và toà nhà 3D trước khi đi xem.",
      },
    ],
  }),
  component: MarketplaceHome,
});

const CITIES = [
  "Thành phố Hồ Chí Minh",
  "Thành phố Hà Nội",
  "Thành phố Đà Nẵng",
  "Tỉnh Bình Dương",
];

// Mỗi câu mẫu đã thử với dữ liệu trình diễn và đều ra tin — câu mẫu trên trang chủ mà trả
// về "0 kết quả" thì phản tác dụng.
const EXAMPLES = [
  "Phòng trọ dưới 5 triệu ở Bình Thạnh",
  "Căn hộ cho thuê Quận 7 có ban công",
  "Mua nhà ở Thủ Đức có sổ hồng",
];

type Mode = "rent" | "sale";
const MODE_TYPE: Record<Mode, ListingTypeCode> = { rent: 2, sale: 1 };

function MarketplaceHome() {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<Mode>("rent");

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <Hero mode={mode} setMode={setMode} />
      <PropertyTypes mode={mode} />
      <div className="mx-auto max-w-[1200px] space-y-14 px-4 py-12">
        <LatestListings mode={mode} setMode={setMode} />
        <Showcase3D />
        <HotAreas mode={mode} />
        <WhyKgs />
      </div>
      {!isAdmin && <OwnerBand />}
      <SiteFooter />
    </div>
  );
}

/* ============================== Hero ============================== */

function Hero({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"ai" | "area">("ai");
  const [ask, setAsk] = useState("");
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");

  const askAi = (text: string) => {
    const q = text.trim();
    if (q.length < 4) {
      toast.message("Mô tả thêm một chút", {
        description: "Ví dụ: loại nhà, khu vực, mức giá, điều bạn cần.",
      });
      return;
    }
    navigate({ to: "/tin-dang", search: { q } });
  };
  const searchArea = () =>
    navigate({
      to: "/tin-dang",
      search: {
        type: MODE_TYPE[mode],
        keyword: keyword.trim() || undefined,
        city: city || undefined,
      },
    });

  return (
    <section className="relative overflow-hidden border-b">
      {/* Nền: lưới mờ + quầng màu thương hiệu — có chiều sâu mà không cần ảnh kho. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--price)_12%,transparent),transparent_50%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:py-16">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Tìm nhà bằng một câu — trợ lý AI hiểu tiếng Việt
          </span>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance lg:text-5xl lg:leading-[1.1]">
            Nói căn bạn cần.{" "}
            <span className="text-price">KGS tìm căn hợp với tổng chi phí thật.</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Mỗi tin ghi rõ điện, nước, phí dịch vụ, nội quy — nhiều toà nhà còn xem được 3D đến từng
            căn trống trước khi bạn đi xem.
          </p>

          <div className="max-w-2xl rounded-2xl border bg-card p-2 shadow-[--shadow-e2]">
            <div className="flex gap-1 p-1" role="tablist" aria-label="Cách tìm">
              <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>
                <Sparkles className="h-3.5 w-3.5" /> Hỏi trợ lý AI
              </TabButton>
              <TabButton active={tab === "area"} onClick={() => setTab("area")}>
                <MapPin className="h-3.5 w-3.5" /> Tìm theo khu vực
              </TabButton>
            </div>

            {tab === "ai" ? (
              <form
                className="flex flex-col gap-2 p-1 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  askAi(ask);
                }}
              >
                <Input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="Mô tả căn bạn cần…"
                  className="h-12 flex-1 border-0 bg-muted/50 text-base focus-visible:ring-1"
                  aria-label="Mô tả căn bạn cần"
                  maxLength={300}
                />
                <Button type="submit" className="h-12 px-6">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Tìm với AI
                </Button>
              </form>
            ) : (
              <form
                className="flex flex-col gap-2 p-1 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  searchArea();
                }}
              >
                <div className="flex shrink-0 rounded-lg bg-muted/50 p-1">
                  {(["rent", "sale"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-md px-3 text-sm font-medium transition-colors ${
                        mode === m ? "bg-card shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {m === "rent" ? "Thuê" : "Mua"}
                    </button>
                  ))}
                </div>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Quận, phường, tên đường…"
                  className="h-12 flex-1 border-0 bg-muted/50 text-base focus-visible:ring-1"
                  aria-label="Từ khoá khu vực"
                />
                <Select value={city || "all"} onValueChange={(v) => setCity(v === "all" ? "" : v)}>
                  <SelectTrigger
                    className="h-12 border-0 bg-muted/50 sm:w-[170px]"
                    aria-label="Tỉnh/thành phố"
                  >
                    <SelectValue placeholder="Toàn quốc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toàn quốc</SelectItem>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/^(Thành phố|Tỉnh) /, "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" className="h-12 px-6">
                  <Search className="mr-1.5 h-4 w-4" /> Tìm
                </Button>
              </form>
            )}
          </div>

          {tab === "ai" && (
            <div className="flex max-w-2xl flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => askAi(ex)}
                  className="rounded-full border bg-card/80 px-3 py-1.5 text-left text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  “{ex}”
                </button>
              ))}
            </div>
          )}

          <LiveStats />
        </div>

        <HeroShowcase />
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Con số thật lấy từ tin đang hiển thị — không phải khẩu hiệu. */
function LiveStats() {
  const rent = useQuery({
    queryKey: ["home-areas", 2],
    queryFn: () => listingsApi.areas(2),
    staleTime: 10 * 60_000,
  });
  const sale = useQuery({
    queryKey: ["home-areas", 1],
    queryFn: () => listingsApi.areas(1),
    staleTime: 10 * 60_000,
  });
  const has3d = useQuery({
    queryKey: ["home-3d", "count"],
    queryFn: () => listingsApi.search({ has3D: true, pageSize: 1 }),
    staleTime: 10 * 60_000,
  });
  const all = [...(rent.data ?? []), ...(sale.data ?? [])];
  if (all.length === 0) return null;
  const total = all.reduce((s, a) => s + a.count, 0);
  const districts = new Set(all.map((a) => `${a.city}:${a.district}`)).size;
  const n3d = has3d.data?.totalCount ?? 0;

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3 pt-1 sm:gap-x-8">
      <Stat value={total} label="tin đang hiển thị" />
      <Stat value={districts} label="quận, huyện có tin" />
      {n3d > 0 && <Stat value={n3d} label="tin xem được 3D" />}
    </dl>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString("vi-VN")}
      </dd>
      <dd className="text-xs text-muted-foreground">{label}</dd>
    </div>
  );
}

/**
 * Bên phải hero: một tin THẬT đang đăng, dựng như thẻ nổi — ảnh lớn, giá, tổng chi phí.
 * Không dùng ảnh kho: ảnh thật tự cập nhật theo hàng đang có, và không hứa thứ không có.
 */
function HeroShowcase() {
  const query = useQuery({
    queryKey: ["home-hero", 2],
    queryFn: () => listingsApi.search({ type: 2, pageSize: 12 }),
    staleTime: 5 * 60_000,
  });
  const pics = (query.data?.items ?? []).filter((l) => l.thumbnailUrl);
  const main = pics[0];
  const side = pics.slice(1, 3);

  if (query.isLoading)
    return <Skeleton className="hidden aspect-[4/5] w-full rounded-2xl lg:block" />;
  if (!main) return null;

  return (
    <div className="relative hidden lg:block" aria-hidden="true">
      <Link
        to="/tin-dang/$slug"
        params={{ slug: main.slug }}
        tabIndex={-1}
        className="block overflow-hidden rounded-2xl border shadow-[--shadow-e3]"
      >
        <img
          src={main.thumbnailUrl!}
          alt=""
          className="aspect-[4/5] w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
        />
      </Link>
      <div className="absolute -left-8 bottom-8 w-64 rounded-xl border bg-card/95 p-3 shadow-[--shadow-e3] backdrop-blur">
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {main.district}, {main.city.replace(/^(Thành phố|Tỉnh) /, "")}
        </p>
        <p className="mt-0.5 text-lg font-semibold text-price tabular-nums">
          {formatListingPrice(main.price, main.type, main.rentPaymentCycle)}
        </p>
        {main.totalMonthlyCost > main.price && (
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-price-soft px-1.5 py-0.5 text-[11px] font-medium text-price">
            <Wallet className="h-3 w-3" />
            Tổng cố định {main.totalMonthlyCost.toLocaleString("vi-VN")} ₫/tháng
          </p>
        )}
      </div>
      {side.length === 2 && (
        <div className="absolute -right-4 top-6 flex flex-col gap-2">
          {side.map((l) => (
            <img
              key={l.id}
              src={l.thumbnailUrl!}
              alt=""
              className="h-20 w-28 rounded-lg border-2 border-card object-cover shadow-[--shadow-e2]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Loại hình ============================== */

const TYPES: { code: number; label: string; icon: LucideIcon; mode?: Mode }[] = [
  { code: 7, label: "Phòng trọ", icon: BedDouble, mode: "rent" },
  { code: 2, label: "Căn hộ", icon: Building2 },
  { code: 1, label: "Nhà riêng", icon: House },
  { code: 5, label: "Nhà mặt phố", icon: Store },
  { code: 3, label: "Đất", icon: LandPlot, mode: "sale" },
  { code: 6, label: "Văn phòng", icon: Briefcase },
  { code: 8, label: "Mặt bằng", icon: Store },
  { code: 9, label: "Kho, xưởng", icon: Warehouse },
];

function PropertyTypes({ mode }: { mode: Mode }) {
  return (
    <section className="border-b bg-card" aria-label="Tìm theo loại hình">
      <div className="mx-auto flex max-w-[1200px] gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] sm:grid sm:grid-cols-8 sm:overflow-visible">
        {TYPES.map((t) => (
          <Link
            key={t.code}
            to="/tin-dang"
            search={{ loai: t.code, type: MODE_TYPE[t.mode ?? mode] }}
            className="group flex min-w-[96px] flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors hover:bg-accent"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <t.icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium">{t.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ============================== Tin mới nhất ============================== */

function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div
      className="inline-flex rounded-lg border bg-card p-0.5"
      role="group"
      aria-label="Thuê hay mua"
    >
      {(["rent", "sale"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m === "rent" ? "Cho thuê" : "Mua bán"}
        </button>
      ))}
    </div>
  );
}

/** Tin mới nhất — bằng chứng nền tảng đang sống. Trang chủ trống là tín hiệu xấu nhất. */
function LatestListings({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ["home-latest", mode],
    queryFn: () => listingsApi.search({ type: MODE_TYPE[mode], pageSize: 8 }),
    retry: 1,
  });

  // Cùng cơ chế với trang tìm kiếm: lấy trọn danh sách đã lưu một lần rồi tra bằng Set.
  const savedQuery = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => savedListingsApi.list(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });
  const savedIds = useMemo(
    () => new Set((savedQuery.data ?? []).map((x) => x.listingId)),
    [savedQuery.data],
  );
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  const toggle = useMutation({
    mutationFn: ({ id, dangLuu }: { id: string; dangLuu: boolean }) =>
      dangLuu ? savedListingsApi.unsave(id) : savedListingsApi.save(id),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["saved-listings"] });
      toast.success(v.dangLuu ? "Đã bỏ lưu tin" : "Đã lưu tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được tin")),
  });

  const onToggleSave = useCallback(
    (id: string) => {
      if (!isAuthenticated) {
        navigate({ to: "/login", search: { redirect: "/" } });
        return;
      }
      toggle.mutate({ id, dangLuu: savedIdsRef.current.has(id) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated],
  );

  const items = query.data?.items ?? [];
  const {
    items: compareItems,
    has: compareHas,
    toggle: compareToggle,
    max: compareMax,
  } = useCompareList();

  return (
    <section className="space-y-5">
      <SectionHead
        title="Tin đăng mới nhất"
        sub="Vừa được duyệt — giá đã cộng sẵn các khoản phí cố định."
        action={
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} setMode={setMode} />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tin-dang" search={{ type: MODE_TYPE[mode] }}>
                Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          Chưa có tin {mode === "rent" ? "cho thuê" : "mua bán"} nào được duyệt.
        </div>
      ) : (
        // Dùng ĐÚNG thẻ tin của trang tìm kiếm — một vật thể, một bản cài đặt.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l) => (
            <PropertyListCard
              key={l.id}
              property={l}
              saved={savedIds.has(l.id)}
              onToggleSave={onToggleSave}
              compareSelected={compareHas(l.id)}
              compareFull={compareItems.length >= compareMax && !compareHas(l.id)}
              onToggleCompare={compareToggle}
              layout="vertical"
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================== Toà nhà 3D ============================== */

/**
 * Tính năng riêng của KGS, nên có hẳn một khối: xem cả toà nhà, tầng nào còn trống, căn của
 * tin nằm ở đâu. Chỉ hiện khi thật sự có tin như vậy.
 */
function Showcase3D() {
  const query = useQuery({
    queryKey: ["home-3d", "list"],
    // Mô hình 3D chủ yếu là toà nhà cho thuê theo phòng; nút dẫn sang đúng tập này nên số
    // tin trên nút khớp với số tin người dùng thấy.
    queryFn: () => listingsApi.search({ has3D: true, type: 2, pageSize: 9 }),
    staleTime: 5 * 60_000,
  });
  // Ưu tiên tin có ảnh: một ô xám trong khối giới thiệu kéo cả khối xuống.
  const all = query.data?.items ?? [];
  const items = [...all.filter((l) => l.thumbnailUrl), ...all.filter((l) => !l.thumbnailUrl)].slice(
    0,
    3,
  );
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-card to-card">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:p-8">
        <div className="flex flex-col justify-center gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Box className="h-3.5 w-3.5" /> Mô hình 3D
          </span>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">
            Thấy cả toà nhà trước khi đi xem
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tầng nào còn căn trống, căn của tin nằm ở góc nào, toà nhà sát những nhà nào — chủ nhà
            dựng mô hình, bạn xoay và bấm từng căn.
          </p>
          <Button asChild className="w-fit">
            <Link to="/tin-dang" search={{ has3D: true, type: 2 }}>
              Xem {query.data?.totalCount ?? items.length} tin cho thuê có 3D
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {items.map((l) => (
            <Link
              key={l.id}
              to="/tin-dang/$slug"
              params={{ slug: l.slug }}
              search={{ xem3d: 1 }}
              className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-[--shadow-e3]"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {l.thumbnailUrl && (
                  <img
                    src={l.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                )}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[11px] font-semibold">
                  <Box className="h-3 w-3" /> 3D
                </span>
              </div>
              <div className="space-y-0.5 p-3">
                <p className="font-semibold text-price tabular-nums">
                  {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                </p>
                <p className="line-clamp-2 text-sm leading-snug">{l.title}</p>
                <p className="truncate text-xs text-muted-foreground">{l.district}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== Khu vực ============================== */

/** Khu vực có thật, số tin có thật — vừa chứng minh có hàng, vừa là lối đi tắt. */
function HotAreas({ mode }: { mode: Mode }) {
  const query = useQuery({
    queryKey: ["home-areas", MODE_TYPE[mode]],
    queryFn: () => listingsApi.areas(MODE_TYPE[mode]),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const areas = (query.data ?? []).filter((k) => k.district).slice(0, 8);
  if (!query.isLoading && areas.length === 0) return null;
  const max = Math.max(1, ...areas.map((a) => a.count));

  return (
    <section className="space-y-5">
      <SectionHead
        title={mode === "rent" ? "Khu vực nhiều tin cho thuê" : "Khu vực nhiều tin mua bán"}
        sub="Bấm để xem ngay các tin đang hiển thị ở khu vực đó."
      />
      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {areas.map((k, i) => (
            <Link
              key={`${k.city}:${k.district}`}
              to="/tin-dang"
              search={{ type: MODE_TYPE[mode], city: k.city, district: k.district }}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{k.district}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {k.city.replace(/^(Thành phố|Tỉnh) /, "")}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  #{i + 1}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all group-hover:bg-primary"
                    style={{ width: `${(k.count / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{k.count} tin</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================== Vì sao KGS + công cụ ============================== */

function WhyKgs() {
  const items: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Wallet,
      title: "Tổng chi phí, không chỉ giá thuê",
      body: "Phí dịch vụ, gửi xe, internet được cộng sẵn. Phòng 7 triệu kèm 500k phí đắt hơn phòng 7,2 triệu trọn gói — con số trên tin đã tính giúp bạn.",
    },
    {
      icon: Sparkles,
      title: "Trợ lý AI hiểu điều bạn nói",
      body: "Gõ như nói chuyện: “gần chỗ làm 15 phút xe máy, cho nuôi mèo”. Trợ lý đổi thành bộ lọc, bạn thấy rõ nó hiểu thế nào và sửa được từng điều kiện.",
    },
    {
      icon: ShieldCheck,
      title: "Tin được duyệt trước khi hiện",
      body: "Mỗi tin qua kiểm duyệt; tin sai bị báo cáo sẽ được xử lý và chủ tin được báo rõ lý do. Nội quy — thú cưng, giờ giấc, ở chung chủ — khai rõ có hay không.",
    },
  ];
  return (
    <section className="space-y-5">
      <SectionHead title="Vì sao tìm nhà trên KGS" />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border bg-card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-price-soft text-price">
              <it.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold leading-snug">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToolLink
          to="/dinh-gia"
          icon={Calculator}
          title="Định giá một căn nhà"
          body="Mô hình học trên hơn 600.000 tin rao — không cần tài khoản."
        />
        <ToolLink
          to="/chi-so-gia"
          icon={LineChart}
          title="Chỉ số giá theo tuần"
          body="Giá ở quận bạn quan tâm đang lên hay xuống."
        />
      </div>
    </section>
  );
}

function ToolLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/dinh-gia" | "/chi-so-gia";
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ============================== Chủ nhà + chân trang ============================== */

function OwnerBand() {
  return (
    <section className="border-y bg-ws-owner-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-5 px-4 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Có nhà cho thuê hoặc bán?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Đăng tin trong 4 bước, AI viết sẵn tiêu đề và mô tả từ thông số, gợi ý giá cho tin bán,
            và báo ngay khi có người hỏi thuê. Miễn phí.
          </p>
        </div>
        <Button size="lg" asChild className="bg-ws-owner text-white hover:bg-ws-owner/90">
          <Link to="/dang-tin">
            <Megaphone className="mr-1.5 h-4 w-4" />
            Đăng tin miễn phí
          </Link>
        </Button>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { isAdmin } = useAuth();
  return (
    <footer className="bg-card">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 pb-28 sm:grid-cols-[minmax(0,1fr)_auto_auto] md:pb-10">
        <div className="space-y-2">
          <p className="font-semibold">KGS</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nền tảng hỗ trợ tìm kiếm và kết nối bất động sản tích hợp AI.
          </p>
        </div>
        <nav className="space-y-2 text-sm" aria-label="Tìm nhà">
          <p className="font-medium">Tìm nhà</p>
          <FooterLink to="/tin-dang">Tất cả tin đăng</FooterLink>
          <FooterLink to="/so-sanh">So sánh tin</FooterLink>
          <FooterLink to="/da-luu">Tin đã lưu</FooterLink>
        </nav>
        <nav className="space-y-2 text-sm" aria-label="Công cụ">
          <p className="font-medium">Công cụ</p>
          <FooterLink to="/dinh-gia">Định giá</FooterLink>
          <FooterLink to="/chi-so-gia">Chỉ số giá</FooterLink>
          {!isAdmin && <FooterLink to="/dang-tin">Đăng tin</FooterLink>}
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-[1200px] px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} KGS. Dữ liệu bản đồ © Mapbox, © OpenStreetMap.
        </p>
      </div>
    </footer>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: "/tin-dang" | "/so-sanh" | "/da-luu" | "/dinh-gia" | "/chi-so-gia" | "/dang-tin";
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className="block text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}
